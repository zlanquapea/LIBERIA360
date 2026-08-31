import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { FoodOrderMessage } from "./entities/food-order-message.entity";
import { FoodOrder } from "../food-orders/entities/food-order.entity";
import { getFoodOrderOwnerUserId } from "../food-orders/food-orders.service";
import { CreateFoodOrderMessageDto } from "./dto/create-food-order-message.dto";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class FoodOrderMessagesService {
  constructor(
    @InjectRepository(FoodOrderMessage)
    private readonly messageRepo: Repository<FoodOrderMessage>,
    @InjectRepository(FoodOrder)
    private readonly orderRepo: Repository<FoodOrder>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    orderId: string,
    dto: CreateFoodOrderMessageDto,
  ): Promise<FoodOrderMessage> {
    const order = await this.assertParticipant(userId, orderId);

    const message = await this.messageRepo.save(
      this.messageRepo.create({
        orderId,
        senderUserId: userId,
        body: dto.body,
      }),
    );

    const ownerUserId = getFoodOrderOwnerUserId(order);
    const recipientUserId =
      userId === order.buyerUserId ? ownerUserId : order.buyerUserId;
    if (recipientUserId) {
      await this.notificationsService.create(recipientUserId, {
        type: "food_order_message.received",
        title: "New message about your order",
        body: dto.body,
        link: "/account/my-orders",
      });
    }

    return this.messageRepo.findOneOrFail({ where: { id: message.id } });
  }

  async findForOrder(
    userId: string,
    orderId: string,
  ): Promise<FoodOrderMessage[]> {
    await this.assertParticipant(userId, orderId);

    return this.messageRepo.find({
      where: { orderId },
      order: { createdAt: "ASC" },
    });
  }

  /** Marks every message the *other* participant sent on this order as
   * read — called when a participant opens the thread, mirrors
   * BookingMessagesService.markRead exactly. */
  async markRead(userId: string, orderId: string): Promise<void> {
    await this.assertParticipant(userId, orderId);

    await this.messageRepo.update(
      { orderId, senderUserId: Not(userId), readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  /** Only the buyer who placed the order or the restaurant's owner can
   * read or post messages on it. Returns the order (business eager-loaded)
   * so `create` can reuse it to figure out who the "other side" is. */
  private async assertParticipant(
    userId: string,
    orderId: string,
  ): Promise<FoodOrder> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order "${orderId}" not found`);
    }
    const isBuyer = order.buyerUserId === userId;
    const isOwner = getFoodOrderOwnerUserId(order) === userId;
    if (!isBuyer && !isOwner) {
      throw new ForbiddenException(
        "Only the buyer or the restaurant owner can access these messages",
      );
    }
    return order;
  }
}
