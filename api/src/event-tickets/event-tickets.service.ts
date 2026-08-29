import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { In, Repository } from "typeorm";
import { Event } from "../events/entities/event.entity";
import { EventReviewStatus } from "../events/entities/event.enums";
import { User } from "../users/entities/user.entity";
import { CreateEventTicketOrderDto } from "./dto/create-event-ticket-order.dto";
import { ReviewEventTicketOrderDto } from "./dto/review-event-ticket-order.dto";
import {
  EventTicketOrder,
  EventTicketOrderStatus,
} from "./entities/event-ticket-order.entity";

@Injectable()
export class EventTicketsService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EventTicketOrder)
    private readonly orderRepo: Repository<EventTicketOrder>,
  ) {}

  private async getEvent(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException(`Event "${id}" not found`);
    return event;
  }

  private async getOrder(id: string): Promise<EventTicketOrder> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException(`Ticket order "${id}" not found`);
    return order;
  }

  private assertOrganizer(order: EventTicketOrder, user: User): void {
    if (order.event.createdByUserId !== user.id) {
      throw new ForbiddenException(
        "Only the event organizer can review tickets",
      );
    }
  }

  async createOrder(
    eventId: string,
    user: User,
    dto: CreateEventTicketOrderDto,
  ): Promise<EventTicketOrder> {
    const event = await this.getEvent(eventId);
    if (event.reviewStatus !== EventReviewStatus.APPROVED) {
      throw new BadRequestException(
        "Tickets are available only for approved events",
      );
    }
    if (!event.ticketPrice || Number(event.ticketPrice) <= 0) {
      throw new BadRequestException(
        "This event does not have paid tickets enabled",
      );
    }
    if (event.ticketCapacity && event.ticketCapacity > 0) {
      const orders = await this.orderRepo.find({
        where: {
          eventId,
          status: In([
            EventTicketOrderStatus.PENDING_PAYMENT_REVIEW,
            EventTicketOrderStatus.APPROVED,
          ]),
        },
      });
      const reserved = orders.reduce((sum, order) => sum + order.quantity, 0);
      if (reserved + dto.quantity > event.ticketCapacity) {
        throw new BadRequestException(
          "Not enough tickets remain for this event",
        );
      }
    }
    const unitPrice = Number(event.ticketPrice);
    const order = this.orderRepo.create({
      event,
      eventId,
      buyer: user,
      buyerUserId: user.id,
      quantity: dto.quantity,
      unitPrice: unitPrice.toFixed(2),
      currency: event.ticketCurrency || "LRD",
      totalAmount: (unitPrice * dto.quantity).toFixed(2),
      paymentReference: dto.paymentReference.trim(),
      paymentNote: dto.paymentNote?.trim() || null,
      status: EventTicketOrderStatus.PENDING_PAYMENT_REVIEW,
      ticketCode: null,
      reviewNote: null,
    });
    return this.orderRepo.save(order);
  }

  async findForBuyer(userId: string): Promise<EventTicketOrder[]> {
    return this.orderRepo.find({
      where: { buyerUserId: userId },
      order: { createdAt: "DESC" },
    });
  }

  async findForOrganizer(
    eventId: string,
    user: User,
  ): Promise<EventTicketOrder[]> {
    const event = await this.getEvent(eventId);
    if (event.createdByUserId !== user.id) {
      throw new ForbiddenException(
        "Only the event organizer can view ticket orders",
      );
    }
    return this.orderRepo.find({
      where: { eventId },
      order: { createdAt: "DESC" },
    });
  }

  async reviewOrder(
    id: string,
    user: User,
    dto: ReviewEventTicketOrderDto,
  ): Promise<EventTicketOrder> {
    const order = await this.getOrder(id);
    this.assertOrganizer(order, user);
    if (order.status !== EventTicketOrderStatus.PENDING_PAYMENT_REVIEW) {
      throw new BadRequestException(
        "Only pending ticket orders can be reviewed",
      );
    }
    order.status = dto.status;
    order.reviewNote = dto.reviewNote?.trim() || null;
    order.ticketCode =
      dto.status === EventTicketOrderStatus.APPROVED
        ? `L360-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`
        : null;
    return this.orderRepo.save(order);
  }
}
