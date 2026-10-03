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
import {
  FoodFulfillment,
  FoodOrderStatus,
  FoodPaymentMethod,
  FoodPaymentStatus,
} from "./entities/food-order.enums";
import { Business } from "../businesses/entities/business.entity";
import {
  BusinessReviewStatus,
  businessHasMenu,
} from "../businesses/entities/business.enums";
import { MenuItem } from "../menu-items/entities/menu-item.entity";
import { MenuItemsService } from "../menu-items/menu-items.service";
import {
  acceptsPaymentMethod,
  deliveryFeeFor,
  paymentAccountFor,
  priceLine,
} from "./order-pricing";
import { CreateFoodOrderDto } from "./dto/create-food-order.dto";
import { RespondFoodOrderDto } from "./dto/respond-food-order.dto";
import { UpdateFoodOrderStatusDto } from "./dto/update-food-order-status.dto";
import { NotificationsService } from "../notifications/notifications.service";

// Both the buyer and the business owner manage every order — placed, and
// received — from the same page, same convention as bookings.
const ORDERS_LINK = "/account/my-orders";

const UNIQUE_VIOLATION = "23505";

const PAYMENT_LABELS: Record<FoodPaymentMethod, string> = {
  [FoodPaymentMethod.CASH]: "cash",
  [FoodPaymentMethod.MTN_MOMO]: "MTN MoMo",
  [FoodPaymentMethod.ORANGE_MONEY]: "Orange Money",
};

// Position of each status the owner can move an order through. Ready and
// out-for-delivery share a step: an order takes one or the other.
const PROGRESS_STEP: Partial<Record<FoodOrderStatus, number>> = {
  [FoodOrderStatus.CONFIRMED]: 0,
  [FoodOrderStatus.PREPARING]: 1,
  [FoodOrderStatus.READY]: 2,
  [FoodOrderStatus.OUT_FOR_DELIVERY]: 2,
  [FoodOrderStatus.COMPLETED]: 3,
};

type ProgressStatus = UpdateFoodOrderStatusDto["status"];

const STATUS_TITLES: Record<ProgressStatus, string> = {
  [FoodOrderStatus.PREPARING]: "Your order is being prepared",
  [FoodOrderStatus.READY]: "Your order is ready for pickup",
  [FoodOrderStatus.OUT_FOR_DELIVERY]: "Your order is on the way",
  [FoodOrderStatus.COMPLETED]: "Order completed",
};

const STATUS_BODIES: Record<ProgressStatus, (business: string) => string> = {
  [FoodOrderStatus.PREPARING]: (b) => `${b} has started on your order.`,
  [FoodOrderStatus.READY]: (b) => `Your order from ${b} is ready to collect.`,
  [FoodOrderStatus.OUT_FOR_DELIVERY]: (b) =>
    `${b} has sent your order out for delivery.`,
  [FoodOrderStatus.COMPLETED]: (b) => `Enjoy your meal from ${b}!`,
};

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
    private readonly menuItemsService: MenuItemsService,
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
    if (!businessHasMenu(business.type)) {
      throw new BadRequestException(
        "Only restaurants and bars accept in-platform orders",
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
      const { unitPrice, options } = priceLine(menuItem, line.selections);
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        unitPrice: unitPrice.toFixed(2),
        quantity: line.quantity,
        options,
      };
    });

    if (
      !dto.ageConfirmed &&
      dto.items.some(
        (line) => menuItemById.get(line.menuItemId)?.containsAlcohol,
      )
    ) {
      throw new BadRequestException(
        "Please confirm you're 18 or older to order alcoholic drinks",
      );
    }

    const settings = await this.menuItemsService.getSettings(businessId);

    const fulfillment = dto.fulfillment ?? FoodFulfillment.PICKUP;
    if (fulfillment === FoodFulfillment.DELIVERY && !settings.deliveryEnabled) {
      throw new BadRequestException(`${business.name} doesn't deliver`);
    }
    if (fulfillment === FoodFulfillment.PICKUP && !settings.pickupEnabled) {
      throw new BadRequestException(
        `${business.name} only takes delivery orders`,
      );
    }
    const deliveryAddress = dto.deliveryAddress?.trim() || null;
    const contactPhone = dto.contactPhone?.trim() || null;
    if (fulfillment === FoodFulfillment.DELIVERY) {
      if (!deliveryAddress) {
        throw new BadRequestException("Add the address to deliver to");
      }
      if (!contactPhone) {
        throw new BadRequestException(
          "Add a phone number so the rider can reach you",
        );
      }
    }

    const paymentMethod = dto.paymentMethod ?? FoodPaymentMethod.CASH;
    if (!acceptsPaymentMethod(settings, paymentMethod)) {
      throw new BadRequestException(
        `${business.name} doesn't accept ${PAYMENT_LABELS[paymentMethod]}`,
      );
    }
    const isMobileMoney = paymentMethod !== FoodPaymentMethod.CASH;
    const paymentReference = dto.paymentReference?.trim() || null;
    if (isMobileMoney && !paymentReference) {
      throw new BadRequestException(
        `Enter the ${PAYMENT_LABELS[paymentMethod]} transaction ID`,
      );
    }

    const subtotal = roundMoney(
      items.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0,
      ),
    );
    const deliveryFee =
      fulfillment === FoodFulfillment.DELIVERY
        ? roundMoney(deliveryFeeFor(settings, subtotal))
        : 0;

    let order: FoodOrder;
    try {
      order = await this.orderRepo.save(
        this.orderRepo.create({
          businessId,
          buyerUserId: userId,
          items,
          subtotal,
          deliveryFee,
          totalAmount: roundMoney(subtotal + deliveryFee),
          currency: settings.currency,
          notes: dto.notes?.trim() || null,
          fulfillment,
          deliveryAddress:
            fulfillment === FoodFulfillment.DELIVERY ? deliveryAddress : null,
          contactPhone,
          paymentMethod,
          paymentStatus: isMobileMoney
            ? FoodPaymentStatus.AWAITING_VERIFICATION
            : FoodPaymentStatus.PAY_ON_DELIVERY,
          paymentReference: isMobileMoney ? paymentReference : null,
          paymentAccount: paymentAccountFor(settings, paymentMethod),
        }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          "That transaction ID is already on another order. Check the ID, or message the restaurant if you think this is a mistake.",
        );
      }
      throw error;
    }
    const saved = await this.orderRepo.findOneOrFail({
      where: { id: order.id },
    });

    if (business.ownerUserId) {
      const how =
        fulfillment === FoodFulfillment.DELIVERY
          ? "for delivery"
          : "for pickup";
      const pay = isMobileMoney
        ? ` Verify ${PAYMENT_LABELS[paymentMethod]} transaction ${paymentReference} before confirming.`
        : "";
      await this.notificationsService.create(business.ownerUserId, {
        type: "food_order.requested",
        title: "New food order",
        body: `${saved.buyer.name} ordered ${describeItemCount(items)} ${how} from ${business.name}.${pay}`,
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

    const confirm = dto.action === "confirm";
    order.status = confirm
      ? FoodOrderStatus.CONFIRMED
      : FoodOrderStatus.DECLINED;
    // For mobile money, confirming is the restaurant saying they found the
    // payment, the same as approving a ticket order.
    if (order.paymentStatus === FoodPaymentStatus.AWAITING_VERIFICATION) {
      order.paymentStatus = confirm
        ? FoodPaymentStatus.PAID
        : dto.paymentNotReceived
          ? FoodPaymentStatus.FAILED
          : FoodPaymentStatus.REFUND_DUE;
    }
    order.businessResponse = dto.message?.trim() || null;
    order.respondedAt = new Date();
    await this.orderRepo.save(order);

    await this.notificationsService.create(order.buyerUserId, {
      type:
        dto.action === "confirm"
          ? "food_order.confirmed"
          : "food_order.declined",
      title: dto.action === "confirm" ? "Order confirmed" : "Order declined",
      body: confirm
        ? `${order.business.name} confirmed your order.`
        : order.paymentStatus === FoodPaymentStatus.FAILED
          ? `${order.business.name} couldn't find your payment and declined the order.`
          : order.paymentStatus === FoodPaymentStatus.REFUND_DUE
            ? `${order.business.name} declined your order and owes you a refund.`
            : `${order.business.name} declined your order.`,
      link: ORDERS_LINK,
    });

    return this.orderRepo.findOneOrFail({ where: { id: orderId } });
  }

  /** Buyer cancels their own order before the restaurant confirms it.
   * After that the kitchen may already be cooking, so they message the
   * restaurant instead. */
  async cancel(userId: string, orderId: string): Promise<FoodOrder> {
    const order = await this.findOrFail(orderId);
    if (order.buyerUserId !== userId) {
      throw new ForbiddenException("You can only cancel your own orders");
    }
    if (order.status !== FoodOrderStatus.PENDING) {
      throw new ConflictException(
        order.status === FoodOrderStatus.DECLINED ||
          order.status === FoodOrderStatus.CANCELLED
          ? `This order is already ${order.status}`
          : "The restaurant has already confirmed this order. Message them to change or cancel it.",
      );
    }

    order.status = FoodOrderStatus.CANCELLED;
    if (order.paymentStatus === FoodPaymentStatus.AWAITING_VERIFICATION) {
      order.paymentStatus = FoodPaymentStatus.REFUND_DUE;
    }
    await this.orderRepo.save(order);

    if (order.business.ownerUserId) {
      await this.notificationsService.create(order.business.ownerUserId, {
        type: "food_order.cancelled",
        title: "Order cancelled",
        body:
          order.paymentStatus === FoodPaymentStatus.REFUND_DUE
            ? `${order.buyer.name} cancelled their order. If their ${PAYMENT_LABELS[order.paymentMethod]} payment reached you, refund it.`
            : `${order.buyer.name} cancelled their order.`,
        link: ORDERS_LINK,
      });
    }
    return this.orderRepo.findOneOrFail({ where: { id: orderId } });
  }

  /** Owner moves a confirmed order along: preparing, then out for delivery
   * or ready for pickup, then completed. Steps can be skipped but never
   * reversed. */
  async updateStatus(
    userId: string,
    orderId: string,
    dto: UpdateFoodOrderStatusDto,
  ): Promise<FoodOrder> {
    const order = await this.findOwnedOrFail(userId, orderId);
    const next = dto.status;
    const currentStep = PROGRESS_STEP[order.status];
    if (currentStep === undefined) {
      throw new ConflictException(
        order.status === FoodOrderStatus.PENDING
          ? "Confirm or decline this order first"
          : `This order is already ${order.status.replace(/_/g, " ")}`,
      );
    }
    if (PROGRESS_STEP[next]! <= currentStep) {
      throw new ConflictException("Orders can only move forward");
    }
    if (
      next === FoodOrderStatus.OUT_FOR_DELIVERY &&
      order.fulfillment !== FoodFulfillment.DELIVERY
    ) {
      throw new BadRequestException("This is a pickup order");
    }
    if (
      next === FoodOrderStatus.READY &&
      order.fulfillment !== FoodFulfillment.PICKUP
    ) {
      throw new BadRequestException("This is a delivery order");
    }

    order.status = next;
    // Cash changes hands when the food does.
    if (
      next === FoodOrderStatus.COMPLETED &&
      order.paymentStatus === FoodPaymentStatus.PAY_ON_DELIVERY
    ) {
      order.paymentStatus = FoodPaymentStatus.PAID;
    }
    await this.orderRepo.save(order);

    await this.notificationsService.create(order.buyerUserId, {
      type: "food_order.updated",
      title: STATUS_TITLES[next],
      body: STATUS_BODIES[next](order.business.name),
      link: ORDERS_LINK,
    });
    return this.orderRepo.findOneOrFail({ where: { id: orderId } });
  }

  /** Owner records that they've sent a mobile money refund back. */
  async markRefunded(userId: string, orderId: string): Promise<FoodOrder> {
    const order = await this.findOwnedOrFail(userId, orderId);
    if (order.paymentStatus !== FoodPaymentStatus.REFUND_DUE) {
      throw new ConflictException("This order has no refund due");
    }
    order.paymentStatus = FoodPaymentStatus.REFUNDED;
    await this.orderRepo.save(order);

    await this.notificationsService.create(order.buyerUserId, {
      type: "food_order.refunded",
      title: "Refund sent",
      body: `${order.business.name} sent your ${PAYMENT_LABELS[order.paymentMethod]} refund.`,
      link: ORDERS_LINK,
    });
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

  private async findOwnedOrFail(
    userId: string,
    orderId: string,
  ): Promise<FoodOrder> {
    const order = await this.findOrFail(orderId);
    if (order.business.ownerUserId !== userId) {
      throw new ForbiddenException(
        "Only the restaurant owner can update this order",
      );
    }
    return order;
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
