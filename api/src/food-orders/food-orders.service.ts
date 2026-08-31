import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { FoodOrder, FoodOrderLineItem } from "./entities/food-order.entity";
import { FoodOrderStatus } from "./entities/food-order.enums";
import { Business } from "../businesses/entities/business.entity";
import {
  BusinessReviewStatus,
  BusinessType,
} from "../businesses/entities/business.enums";
import { MenuItem } from "../menu-items/entities/menu-item.entity";
import { CreateFoodOrderDto } from "./dto/create-food-order.dto";
import { RespondFoodOrderDto } from "./dto/respond-food-order.dto";
import { NotificationsService } from "../notifications/notifications.service";

// Both the buyer and the business owner manage every order — placed, and
// received — from the same page, same convention as bookings.
const ORDERS_LINK = "/account/my-orders";

@Injectable()
export class FoodOrdersService {
  constructor(
    @InjectRepository(FoodOrder)
    private readonly orderRepo: Repository<FoodOrder>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(MenuItem)
    private readonly menuItemRepo: Repository<MenuItem>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    businessId: string,
    dto: CreateFoodOrderDto,
  ): Promise<FoodOrder> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.reviewStatus !== BusinessReviewStatus.APPROVED) {
      throw new BadRequestException("This business isn't accepting orders yet");
    }
    if (business.type !== BusinessType.RESTAURANT) {
      throw new BadRequestException(
        "Only restaurants accept in-platform orders",
      );
    }

    const menuItemIds = dto.items.map((item) => item.menuItemId);
    const menuItems = await this.menuItemRepo.find({
      where: { id: In(menuItemIds), businessId },
    });
    const menuItemById = new Map(menuItems.map((item) => [item.id, item]));

    // Every line item must resolve to a real, currently-available dish on
    // *this* business's own menu — never trust a client-submitted name or
    // price (see FoodOrderLineItem's doc comment: those are snapshotted
    // here from the live catalog, not accepted as input).
    const items: FoodOrderLineItem[] = dto.items.map((line) => {
      const menuItem = menuItemById.get(line.menuItemId);
      if (!menuItem) {
        throw new BadRequestException(
          `"${line.menuItemId}" is not on this restaurant's menu`,
        );
      }
      if (!menuItem.isAvailable) {
        throw new BadRequestException(`${menuItem.name} is sold out`);
      }
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        unitPrice: menuItem.price.toFixed(2),
        quantity: line.quantity,
      };
    });
    const totalAmount = items.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        businessId,
        buyerUserId: userId,
        items,
        totalAmount,
        notes: dto.notes?.trim() || null,
      }),
    );
    const saved = await this.orderRepo.findOneOrFail({
      where: { id: order.id },
    });

    if (business.ownerUserId) {
      await this.notificationsService.create(business.ownerUserId, {
        type: "food_order.requested",
        title: "New food order",
        body: `${saved.buyer.name} ordered ${describeItemCount(items)} from ${business.name}.`,
        link: ORDERS_LINK,
      });
    }
    return saved;
  }

  /** Business owner confirms or declines a pending order. */
  async respond(
    userId: string,
    orderId: string,
    dto: RespondFoodOrderDto,
  ): Promise<FoodOrder> {
    const order = await this.findOrFail(orderId);
    if (order.business.ownerUserId !== userId) {
      throw new ForbiddenException(
        "Only the restaurant owner can respond to this order",
      );
    }
    if (order.status !== FoodOrderStatus.PENDING) {
      throw new ConflictException(
        `This order has already been ${order.status}`,
      );
    }

    order.status =
      dto.action === "confirm"
        ? FoodOrderStatus.CONFIRMED
        : FoodOrderStatus.DECLINED;
    order.businessResponse = dto.message ?? null;
    order.respondedAt = new Date();
    await this.orderRepo.save(order);

    await this.notificationsService.create(order.buyerUserId, {
      type:
        dto.action === "confirm"
          ? "food_order.confirmed"
          : "food_order.declined",
      title: dto.action === "confirm" ? "Order confirmed" : "Order declined",
      body:
        dto.action === "confirm"
          ? `${order.business.name} confirmed your order.`
          : `${order.business.name} declined your order.`,
      link: ORDERS_LINK,
    });

    return this.orderRepo.findOneOrFail({ where: { id: orderId } });
  }

  /** Buyer cancels their own pending or confirmed order. */
  async cancel(userId: string, orderId: string): Promise<FoodOrder> {
    const order = await this.findOrFail(orderId);
    if (order.buyerUserId !== userId) {
      throw new ForbiddenException("You can only cancel your own orders");
    }
    if (
      order.status !== FoodOrderStatus.PENDING &&
      order.status !== FoodOrderStatus.CONFIRMED
    ) {
      throw new ConflictException(
        `This order is already ${order.status} and can't be cancelled`,
      );
    }

    order.status = FoodOrderStatus.CANCELLED;
    await this.orderRepo.save(order);
    return this.orderRepo.findOneOrFail({ where: { id: orderId } });
  }

  findMine(userId: string): Promise<FoodOrder[]> {
    return this.orderRepo.find({
      where: { buyerUserId: userId },
      order: { createdAt: "DESC" },
    });
  }

  async findForBusiness(
    userId: string,
    businessId: string,
  ): Promise<FoodOrder[]> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId !== userId) {
      throw new ForbiddenException(
        "Only the business owner can view its orders",
      );
    }

    return this.orderRepo.find({
      where: { businessId },
      order: { createdAt: "DESC" },
    });
  }

  private async findOrFail(orderId: string): Promise<FoodOrder> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }
    return order;
  }
}

/** exported for FoodOrderMessagesService, which needs the identical
 * "who's a participant" resolution for messaging on an order. */
export function getFoodOrderOwnerUserId(order: FoodOrder): string | null {
  return order.business?.ownerUserId ?? null;
}

function describeItemCount(items: FoodOrderLineItem[]): string {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  return `${count} item${count === 1 ? "" : "s"}`;
}
