import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import * as QRCode from "qrcode";
import { In, Repository } from "typeorm";
import { Event } from "../events/entities/event.entity";
import { EventReviewStatus } from "../events/entities/event.enums";
import { User } from "../users/entities/user.entity";
import { CreateEventTicketOrderDto } from "./dto/create-event-ticket-order.dto";
import { RedeemEventTicketDto } from "./dto/redeem-event-ticket.dto";
import { ReviewEventTicketOrderDto } from "./dto/review-event-ticket-order.dto";
import {
  EventTicketInstance,
  EventTicketInstanceStatus,
} from "./entities/event-ticket-instance.entity";
import {
  EventTicketOrder,
  EventTicketOrderStatus,
} from "./entities/event-ticket-order.entity";

export interface BuyerTicketQr {
  id: string;
  sequence: number;
  status: EventTicketInstanceStatus;
  qrDataUrl: string;
  redeemedAt: Date | null;
}

export type BuyerEventTicketOrder = EventTicketOrder & {
  tickets: BuyerTicketQr[];
};

@Injectable()
export class EventTicketsService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EventTicketOrder)
    private readonly orderRepo: Repository<EventTicketOrder>,
    @InjectRepository(EventTicketInstance)
    private readonly instanceRepo?: Repository<EventTicketInstance>,
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
        "Only the event organizer can review or scan tickets",
      );
    }
  }

  private getQrKey(): Buffer {
    return createHash("sha256")
      .update(
        process.env.TICKET_QR_SECRET ||
          process.env.JWT_SECRET ||
          "liberia360-development-ticket-secret",
      )
      .digest();
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private encryptToken(token: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.getQrKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(token, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      iv.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  private decryptToken(ciphertext: string): string {
    const [ivEncoded, tagEncoded, dataEncoded] = ciphertext.split(".");
    if (!ivEncoded || !tagEncoded || !dataEncoded) {
      throw new Error("Invalid ticket token envelope");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.getQrKey(),
      Buffer.from(ivEncoded, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataEncoded, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private ticketPayload(instanceId: string, token: string): string {
    return `L360TICKET:v1:${instanceId}:${token}`;
  }

  private parseTicketPayload(payload: string): {
    instanceId: string;
    token: string;
  } {
    const match = /^L360TICKET:v1:([0-9a-f-]{36}):([A-Za-z0-9_-]{40,80})$/.exec(
      payload.trim(),
    );
    if (!match)
      throw new BadRequestException(
        "This is not a valid LIBERIA360 ticket QR code",
      );
    return { instanceId: match[1], token: match[2] };
  }

  private async serializeBuyerOrder(
    order: EventTicketOrder,
  ): Promise<BuyerEventTicketOrder> {
    if (!this.instanceRepo)
      throw new Error("Ticket instance repository is unavailable");
    const instances = await this.instanceRepo.find({
      where: { orderId: order.id },
      order: { sequence: "ASC" },
    });
    const tickets = await Promise.all(
      instances.map(async (instance) => {
        let qrDataUrl = "";
        if (instance.status !== EventTicketInstanceStatus.VOID) {
          const token = this.decryptToken(instance.tokenCiphertext);
          qrDataUrl = await QRCode.toDataURL(
            this.ticketPayload(instance.id, token),
            {
              errorCorrectionLevel: "H",
              margin: 2,
              width: 640,
              color: { dark: "#071a52", light: "#ffffff" },
            },
          );
        }
        return {
          id: instance.id,
          sequence: instance.sequence,
          status: instance.status,
          qrDataUrl,
          redeemedAt: instance.redeemedAt,
        };
      }),
    );
    return Object.assign(order, { tickets });
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
    if ((!event.ticketTypes?.length) && (!event.ticketPrice || Number(event.ticketPrice) <= 0)) {
      throw new BadRequestException(
        "This event does not have paid tickets enabled",
      );
    }
    if (event.ticketTypes?.length && !dto.selections?.length) {
      throw new BadRequestException(
        "Choose at least one ticket type for this event",
      );
    }
    const selections = event.ticketTypes?.length && dto.selections?.length
      ? dto.selections.map((selection) => {
          const type = event.ticketTypes.find((ticket) => ticket.id === selection.ticketTypeId);
          const quantity = Number(selection.quantity);
          if (!type || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new BadRequestException("Choose a valid ticket type and quantity");
          const now = new Date();
          if ((type.salesStart && now < new Date(type.salesStart)) || (type.salesEnd && now > new Date(type.salesEnd))) throw new BadRequestException(`${type.name} is not currently on sale`);
          return { ticketTypeId: type.id, name: type.name, quantity, unitPrice: type.price };
        })
      : [];
    const requestedQuantity = selections.length ? selections.reduce((sum, item) => sum + item.quantity, 0) : (dto.quantity ?? 0);
    if (requestedQuantity < 1 || requestedQuantity > 20) throw new BadRequestException("Choose between 1 and 20 tickets");
    if (event.ticketTypes?.length) {
      const orders = await this.orderRepo.find({ where: { eventId, status: In([EventTicketOrderStatus.PENDING_PAYMENT_REVIEW, EventTicketOrderStatus.APPROVED]) } });
      for (const item of selections) {
        const capacity = event.ticketTypes.find((ticket) => ticket.id === item.ticketTypeId)!.quantity;
        const reserved = orders.flatMap((order) => order.items || []).filter((line) => line.ticketTypeId === item.ticketTypeId).reduce((sum, line) => sum + line.quantity, 0);
        if (reserved + item.quantity > capacity) throw new BadRequestException(`Not enough ${item.name} tickets remain`);
      }
    } else if (event.ticketCapacity && event.ticketCapacity > 0) {
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
      if (reserved + requestedQuantity > event.ticketCapacity) {
        throw new BadRequestException(
          "Not enough tickets remain for this event",
        );
      }
    }
    const total = selections.length ? selections.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0) : Number(event.ticketPrice) * requestedQuantity;
    const unitPrice = selections.length ? total / requestedQuantity : Number(event.ticketPrice);
    const order = this.orderRepo.create({
      event,
      eventId,
      buyer: user,
      buyerUserId: user.id,
      quantity: requestedQuantity,
      items: selections,
      unitPrice: unitPrice.toFixed(2),
      currency: event.ticketCurrency || "LRD",
      totalAmount: total.toFixed(2),
      paymentReference: dto.paymentReference.trim(),
      paymentNote: dto.paymentNote?.trim() || null,
      status: EventTicketOrderStatus.PENDING_PAYMENT_REVIEW,
      ticketCode: null,
      reviewNote: null,
    });
    return this.orderRepo.save(order);
  }

  async findForBuyer(userId: string): Promise<BuyerEventTicketOrder[]> {
    const orders = await this.orderRepo.find({
      where: { buyerUserId: userId },
      order: { createdAt: "DESC" },
    });
    return Promise.all(orders.map((order) => this.serializeBuyerOrder(order)));
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

    const saveApproved = async (
      orderRepository: Repository<EventTicketOrder>,
      instanceRepository: Repository<EventTicketInstance>,
    ) => {
      const saved = await orderRepository.save(order);
      if (
        dto.status === EventTicketOrderStatus.APPROVED &&
        instanceRepository
      ) {
        const instances = Array.from({ length: order.quantity }, (_, index) => {
          const token = randomBytes(32).toString("base64url");
          return instanceRepository.create({
            order: saved,
            orderId: saved.id,
            sequence: index + 1,
            tokenHash: this.hashToken(token),
            tokenCiphertext: this.encryptToken(token),
            status: EventTicketInstanceStatus.ISSUED,
            redeemedAt: null,
            redeemedBy: null,
            redeemedByUserId: null,
            scanCount: 0,
            lastScannedAt: null,
            lastScannedBy: null,
            lastScannedByUserId: null,
          });
        });
        await instanceRepository.save(instances);
      }
      return saved;
    };

    const manager = this.orderRepo.manager;
    if (manager?.transaction) {
      return manager.transaction(async (transactionManager) =>
        saveApproved(
          transactionManager.getRepository(EventTicketOrder),
          transactionManager.getRepository(EventTicketInstance),
        ),
      );
    }
    return saveApproved(
      this.orderRepo,
      this.instanceRepo as Repository<EventTicketInstance>,
    );
  }

  async redeemTicket(
    eventId: string,
    user: User,
    dto: RedeemEventTicketDto,
  ): Promise<{
    valid: true;
    ticketId: string;
    eventName: string;
    ticketNumber: number;
    redeemedAt: Date;
  }> {
    const event = await this.getEvent(eventId);
    if (event.createdByUserId !== user.id) {
      throw new ForbiddenException("Only the event organizer can scan tickets");
    }
    if (!this.instanceRepo)
      throw new Error("Ticket instance repository is unavailable");
    const { instanceId, token } = this.parseTicketPayload(dto.payload);
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId, order: { eventId } },
      relations: { order: true },
    });
    if (!instance || instance.order.eventId !== eventId) {
      throw new NotFoundException("Ticket not found for this event");
    }
    const suppliedHash = Buffer.from(this.hashToken(token), "hex");
    const storedHash = Buffer.from(instance.tokenHash, "hex");
    if (
      suppliedHash.length !== storedHash.length ||
      !timingSafeEqual(suppliedHash, storedHash)
    ) {
      throw new BadRequestException("This ticket QR code is invalid");
    }
    if (instance.status !== EventTicketInstanceStatus.ISSUED) {
      throw new ConflictException(
        instance.status === EventTicketInstanceStatus.REDEEMED
          ? "This ticket has already been scanned"
          : "This ticket is no longer valid",
      );
    }

    const redeemedAt = new Date();
    const result = await this.instanceRepo
      .createQueryBuilder()
      .update(EventTicketInstance)
      .set({
        status: EventTicketInstanceStatus.REDEEMED,
        redeemedAt,
        redeemedByUserId: user.id,
        scanCount: () => '"scan_count" + 1',
        lastScannedAt: redeemedAt,
        lastScannedByUserId: user.id,
      })
      .where("id = :id", { id: instance.id })
      .andWhere("status = :status", {
        status: EventTicketInstanceStatus.ISSUED,
      })
      .execute();
    if (result.affected !== 1) {
      throw new ConflictException("This ticket has already been scanned");
    }
    return {
      valid: true,
      ticketId: instance.id,
      eventName: event.name,
      ticketNumber: instance.sequence,
      redeemedAt,
    };
  }
}
