import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Not, Repository } from "typeorm";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingMessage } from "../booking-messages/entities/booking-message.entity";
import { FoodOrder } from "../food-orders/entities/food-order.entity";
import { FoodOrderMessage } from "../food-order-messages/entities/food-order-message.entity";
import { SupportMessage } from "../support/entities/support-message.entity";
import { SupportTicket } from "../support/entities/support-ticket.entity";
import { ConversationsService } from "./conversations.service";

export interface UnifiedInboxItem {
  id: string;
  kind: "conversation" | "booking" | "food-order" | "support";
  title: string;
  preview: string;
  updatedAt: Date;
  unreadCount: number;
  href: string;
  contextType: string;
  sourceId: string;
}

@Injectable()
export class UnifiedInboxService {
  constructor(
    private readonly conversations: ConversationsService,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingMessage)
    private readonly bookingMessageRepo: Repository<BookingMessage>,
    @InjectRepository(FoodOrder)
    private readonly foodOrderRepo: Repository<FoodOrder>,
    @InjectRepository(FoodOrderMessage)
    private readonly foodOrderMessageRepo: Repository<FoodOrderMessage>,
    @InjectRepository(SupportTicket)
    private readonly supportTicketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportMessage)
    private readonly supportMessageRepo: Repository<SupportMessage>,
  ) {}

  async list(userId: string): Promise<UnifiedInboxItem[]> {
    const items: UnifiedInboxItem[] = (
      await this.conversations.list(userId)
    ).map((item) => ({
      id: `conversation:${item.id}`,
      kind: "conversation",
      title: item.otherParticipant?.name ?? item.title ?? "Conversation",
      preview: item.lastMessage?.body ?? "Start the conversation",
      updatedAt: item.lastMessage?.createdAt ?? item.createdAt,
      unreadCount: item.unreadCount,
      href: `/messages/${item.id}`,
      contextType: item.contextType,
      sourceId: item.id,
    }));

    const bookings = await this.bookingRepo.find();
    for (const booking of bookings) {
      const ownerId =
        booking.business?.ownerUserId ??
        booking.creator?.userId ??
        booking.carListing?.ownerUserId;
      if (booking.guestUserId !== userId && ownerId !== userId) continue;
      const latest = await this.bookingMessageRepo.findOne({
        where: { bookingId: booking.id },
        order: { createdAt: "DESC" },
      });
      if (!latest) continue;
      items.push({
        id: `booking:${booking.id}`,
        kind: "booking",
        title:
          booking.business?.name ??
          booking.creator?.name ??
          booking.carListing?.title ??
          "Booking",
        preview: latest.body,
        updatedAt: latest.createdAt,
        unreadCount: await this.bookingMessageRepo.count({
          where: {
            bookingId: booking.id,
            senderUserId: Not(userId),
            readAt: IsNull(),
          },
        }),
        href: "/account/bookings",
        contextType: "booking",
        sourceId: booking.id,
      });
    }

    const orders = await this.foodOrderRepo.find();
    for (const order of orders) {
      if (
        order.buyerUserId !== userId &&
        order.business?.ownerUserId !== userId
      )
        continue;
      const latest = await this.foodOrderMessageRepo.findOne({
        where: { orderId: order.id },
        order: { createdAt: "DESC" },
      });
      if (!latest) continue;
      items.push({
        id: `food-order:${order.id}`,
        kind: "food-order",
        title: order.business?.name ?? "Food order",
        preview: latest.body,
        updatedAt: latest.createdAt,
        unreadCount: await this.foodOrderMessageRepo.count({
          where: {
            orderId: order.id,
            senderUserId: Not(userId),
            readAt: IsNull(),
          },
        }),
        href: "/account/my-orders",
        contextType: "food-order",
        sourceId: order.id,
      });
    }

    const tickets = await this.supportTicketRepo.find({
      where: { customerUserId: userId },
    });
    for (const ticket of tickets) {
      const latest = await this.supportMessageRepo.findOne({
        where: { ticketId: ticket.id },
        order: { createdAt: "DESC" },
      });
      if (!latest) continue;
      items.push({
        id: `support:${ticket.id}`,
        kind: "support",
        title: ticket.subject,
        preview: latest.body,
        updatedAt: latest.createdAt,
        unreadCount: await this.supportMessageRepo.count({
          where: {
            ticketId: ticket.id,
            senderUserId: Not(userId),
            readAt: IsNull(),
          },
        }),
        href: `/account/support/${ticket.id}`,
        contextType: "support",
        sourceId: ticket.id,
      });
    }

    return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
}
