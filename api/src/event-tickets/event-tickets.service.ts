import {
  BadRequestException,
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
import { In, IsNull, Repository } from "typeorm";
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
  ticketNumber: string;
  ticketTypeName: string;
  status: EventTicketInstanceStatus;
  qrDataUrl: string;
  redeemedAt: Date | null;
}

export type BuyerEventTicketOrder = EventTicketOrder & {
  tickets: BuyerTicketQr[];
};

// Lightweight per-ticket status for the organizer's order-management view —
// enough to list and cancel individual passes without handing back QR
// images or anything that could authenticate a scan.
export interface OrganizerTicketSummary {
  id: string;
  sequence: number;
  ticketNumber: string;
  ticketTypeName: string;
  status: EventTicketInstanceStatus;
  redeemedAt: Date | null;
}

export type OrganizerEventTicketOrder = EventTicketOrder & {
  tickets: OrganizerTicketSummary[];
};

export type EventTicketScanOutcome =
  "valid" | "already_used" | "cancelled" | "wrong_event" | "invalid";

export interface ScannedTicketSummary {
  id: string;
  ticketNumber: string;
  ticketTypeName: string;
  eventName: string;
  orderId: string;
}

export interface EventTicketScanResult {
  outcome: EventTicketScanOutcome;
  message: string;
  ticket?: ScannedTicketSummary;
  // Only present for "already_used" — the point of it: give staff enough
  // context to recognize a genuine-but-reused QR code without exposing it
  // anywhere else (see redeemTicket's ordering: this is decided only after
  // the token itself checks out).
  firstScannedAt?: string;
}

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

  // Short uppercase code for a human-readable ticket number, e.g.
  // "VIP" -> "VIP", "Regular" -> "REG", "Early Bird" -> "EB",
  // "General Admission" -> "GA". Purely cosmetic — never used to look up
  // or authenticate a ticket, only to label it.
  private ticketTypeCode(name: string): string {
    const cleaned = name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .trim();
    if (!cleaned) return "GEN";
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length > 1)
      return words
        .map((word) => word[0])
        .join("")
        .slice(0, 4);
    return words[0].slice(0, 3);
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
          ticketNumber: instance.ticketNumber,
          ticketTypeName: instance.ticketTypeName,
          status: instance.status,
          qrDataUrl,
          redeemedAt: instance.redeemedAt,
        };
      }),
    );
    return Object.assign(order, { tickets });
  }

  private async serializeOrganizerOrder(
    order: EventTicketOrder,
  ): Promise<OrganizerEventTicketOrder> {
    if (!this.instanceRepo)
      throw new Error("Ticket instance repository is unavailable");
    const instances = await this.instanceRepo.find({
      where: { orderId: order.id },
      order: { sequence: "ASC" },
    });
    const tickets = instances.map((instance) => ({
      id: instance.id,
      sequence: instance.sequence,
      ticketNumber: instance.ticketNumber,
      ticketTypeName: instance.ticketTypeName,
      status: instance.status,
      redeemedAt: instance.redeemedAt,
    }));
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
    if (
      !event.ticketTypes?.length &&
      (!event.ticketPrice || Number(event.ticketPrice) <= 0)
    ) {
      throw new BadRequestException(
        "This event does not have paid tickets enabled",
      );
    }
    if (event.ticketTypes?.length && !dto.selections?.length) {
      throw new BadRequestException(
        "Choose at least one ticket type for this event",
      );
    }
    const rawSelections =
      event.ticketTypes?.length && dto.selections?.length
        ? dto.selections.map((selection) => {
            const type = event.ticketTypes.find(
              (ticket) => ticket.id === selection.ticketTypeId,
            );
            const quantity = Number(selection.quantity);
            if (
              !type ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > 20
            )
              throw new BadRequestException(
                "Choose a valid ticket type and quantity",
              );
            const now = new Date();
            if (
              (type.salesStart && now < new Date(type.salesStart)) ||
              (type.salesEnd && now > new Date(type.salesEnd))
            )
              throw new BadRequestException(
                `${type.name} is not currently on sale`,
              );
            return {
              ticketTypeId: type.id,
              name: type.name,
              quantity,
              unitPrice: type.price,
            };
          })
        : [];
    // A request can list the same ticketTypeId more than once (e.g. two
    // separate line items the client never merged) — aggregate those
    // before the per-type capacity check below, which otherwise compares
    // each line only against already-*saved* orders and would let two
    // halves of a single oversell through independently.
    const selections = Array.from(
      rawSelections
        .reduce((byType, item) => {
          const existing = byType.get(item.ticketTypeId);
          byType.set(
            item.ticketTypeId,
            existing
              ? { ...existing, quantity: existing.quantity + item.quantity }
              : item,
          );
          return byType;
        }, new Map<string, (typeof rawSelections)[number]>())
        .values(),
    );
    const requestedQuantity = selections.length
      ? selections.reduce((sum, item) => sum + item.quantity, 0)
      : (dto.quantity ?? 0);
    if (requestedQuantity < 1 || requestedQuantity > 20)
      throw new BadRequestException("Choose between 1 and 20 tickets");
    if (event.ticketTypes?.length) {
      const orders = await this.orderRepo.find({
        where: {
          eventId,
          status: In([
            EventTicketOrderStatus.PENDING_PAYMENT_REVIEW,
            EventTicketOrderStatus.APPROVED,
          ]),
        },
      });
      for (const item of selections) {
        const capacity = event.ticketTypes.find(
          (ticket) => ticket.id === item.ticketTypeId,
        )!.quantity;
        const reserved = orders
          .flatMap((order) => order.items || [])
          .filter((line) => line.ticketTypeId === item.ticketTypeId)
          .reduce((sum, line) => sum + line.quantity, 0);
        if (reserved + item.quantity > capacity)
          throw new BadRequestException(
            `Not enough ${item.name} tickets remain`,
          );
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
    const total = selections.length
      ? selections.reduce(
          (sum, item) => sum + Number(item.unitPrice) * item.quantity,
          0,
        )
      : Number(event.ticketPrice) * requestedQuantity;
    const unitPrice = selections.length
      ? total / requestedQuantity
      : Number(event.ticketPrice);
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
  ): Promise<OrganizerEventTicketOrder[]> {
    const event = await this.getEvent(eventId);
    if (event.createdByUserId !== user.id) {
      throw new ForbiddenException(
        "Only the event organizer can view ticket orders",
      );
    }
    const orders = await this.orderRepo.find({
      where: { eventId },
      order: { createdAt: "DESC" },
    });
    return Promise.all(
      orders.map((order) =>
        order.status === EventTicketOrderStatus.APPROVED
          ? this.serializeOrganizerOrder(order)
          : Object.assign(order, { tickets: [] }),
      ),
    );
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
        // Issue tickets per selected type (2 VIP + 3 Regular -> 5 individually
        // typed passes), not one undifferentiated batch of `quantity` — a
        // legacy non-typed event (single ticketPrice/ticketCapacity, no
        // `items`) still issues `quantity` passes, just all labeled the same
        // generic type.
        const typeGroups = saved.items?.length
          ? saved.items.map((item) => ({
              ticketTypeId: item.ticketTypeId as string | null,
              ticketTypeName: item.name,
              quantity: item.quantity,
            }))
          : [
              {
                ticketTypeId: null as string | null,
                ticketTypeName: "General Admission",
                quantity: saved.quantity,
              },
            ];

        // Continue each type's human-readable numbering from how many of
        // that type have already been issued for this event, so numbers
        // stay meaningful (and non-repeating) across separate orders rather
        // than restarting at 1 every time.
        const nextNumberByType = new Map<string, number>();
        for (const group of typeGroups) {
          const key = group.ticketTypeId ?? group.ticketTypeName;
          if (nextNumberByType.has(key)) continue;
          const issuedSoFar = await instanceRepository.count({
            where: {
              eventId: saved.eventId,
              ticketTypeId: group.ticketTypeId ?? IsNull(),
            },
          });
          nextNumberByType.set(key, issuedSoFar);
        }

        let sequence = 0;
        const instances: EventTicketInstance[] = [];
        for (const group of typeGroups) {
          const key = group.ticketTypeId ?? group.ticketTypeName;
          const code = this.ticketTypeCode(group.ticketTypeName);
          for (let i = 0; i < group.quantity; i++) {
            sequence += 1;
            const number = (nextNumberByType.get(key) ?? 0) + 1;
            nextNumberByType.set(key, number);
            const token = randomBytes(32).toString("base64url");
            instances.push(
              instanceRepository.create({
                order: saved,
                orderId: saved.id,
                event: saved.event,
                eventId: saved.eventId,
                sequence,
                ticketTypeId: group.ticketTypeId,
                ticketTypeName: group.ticketTypeName,
                ticketNumber: `L360-${code}-${String(number).padStart(5, "0")}`,
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
              }),
            );
          }
        }
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

  // Scanning always returns 200 with an `outcome` — never throws for a bad
  // or reused ticket — so the scanner UI can render each of valid /
  // already_used / cancelled / wrong_event / invalid without picking apart
  // HTTP status codes. The only thrown errors left are route-level (wrong
  // event id, not the organizer): those aren't ticket states, they're
  // requests that shouldn't have been made at all.
  //
  // Order matters here for security: the QR's token is checked FIRST, and
  // every state-specific reply (which ticket type, which event, when it was
  // first scanned) is only ever built after that check passes. A copied or
  // guessed instance id with the wrong token gets the same generic
  // "invalid" reply as one that doesn't exist at all — it never learns
  // whether the id it guessed was real, what type it was, or that it
  // belongs to a different event.
  async redeemTicket(
    eventId: string,
    user: User,
    dto: RedeemEventTicketDto,
  ): Promise<EventTicketScanResult> {
    const event = await this.getEvent(eventId);
    if (event.createdByUserId !== user.id) {
      throw new ForbiddenException("Only the event organizer can scan tickets");
    }
    if (!this.instanceRepo)
      throw new Error("Ticket instance repository is unavailable");

    let parsed: { instanceId: string; token: string };
    try {
      parsed = this.parseTicketPayload(dto.payload);
    } catch {
      return {
        outcome: "invalid",
        message: "This is not a valid LIBERIA360 ticket QR code.",
      };
    }
    const { instanceId, token } = parsed;
    // Deliberately not scoped to this event yet — the wrong-event outcome
    // below needs to see a ticket that exists for a *different* event, and
    // that distinction (exists elsewhere vs. doesn't exist at all) only
    // gets decided once the token is confirmed genuine.
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: { order: true },
    });
    if (!instance) {
      return {
        outcome: "invalid",
        message: "This QR code does not match any LIBERIA360 ticket.",
      };
    }
    const suppliedHash = Buffer.from(this.hashToken(token), "hex");
    const storedHash = Buffer.from(instance.tokenHash, "hex");
    if (
      suppliedHash.length !== storedHash.length ||
      !timingSafeEqual(suppliedHash, storedHash)
    ) {
      return {
        outcome: "invalid",
        message: "This ticket QR code is invalid.",
      };
    }

    const ticket: ScannedTicketSummary = {
      id: instance.id,
      ticketNumber: instance.ticketNumber,
      ticketTypeName: instance.ticketTypeName,
      eventName: instance.order.event?.name ?? event.name,
      orderId: instance.orderId,
    };

    if (instance.eventId !== eventId) {
      return {
        outcome: "wrong_event",
        message: `This ticket belongs to "${ticket.eventName}", not this event.`,
        ticket,
      };
    }
    if (instance.status === EventTicketInstanceStatus.VOID) {
      return {
        outcome: "cancelled",
        message: "This ticket has been cancelled and cannot be used.",
        ticket,
      };
    }
    if (instance.status === EventTicketInstanceStatus.REDEEMED) {
      return {
        outcome: "already_used",
        message: "This ticket was previously scanned successfully.",
        ticket,
        firstScannedAt: (instance.redeemedAt ?? new Date()).toISOString(),
      };
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
      // Raced with another scan of the same ticket between our read above
      // and this write — re-read so the reply still reflects reality
      // (almost always "already_used" a moment sooner than expected).
      const fresh = await this.instanceRepo.findOne({
        where: { id: instance.id },
      });
      return {
        outcome:
          fresh?.status === EventTicketInstanceStatus.VOID
            ? "cancelled"
            : "already_used",
        message:
          fresh?.status === EventTicketInstanceStatus.VOID
            ? "This ticket has been cancelled and cannot be used."
            : "This ticket was previously scanned successfully.",
        ticket,
        firstScannedAt: fresh?.redeemedAt?.toISOString(),
      };
    }
    return {
      outcome: "valid",
      message: "Entry approved.",
      ticket,
    };
  }

  // Organizer-only: mark one issued or already-redeemed ticket as
  // cancelled (lost, refunded, fraudulent payment reference, etc.) without
  // touching the rest of its order — ticket usage is tracked per instance,
  // never at the order level, so cancelling one never affects its
  // siblings.
  async voidTicket(
    instanceId: string,
    user: User,
  ): Promise<OrganizerTicketSummary> {
    if (!this.instanceRepo)
      throw new Error("Ticket instance repository is unavailable");
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: { order: true },
    });
    if (!instance) throw new NotFoundException("Ticket not found");
    if (instance.order.event.createdByUserId !== user.id) {
      throw new ForbiddenException(
        "Only the event organizer can cancel tickets",
      );
    }
    if (instance.status === EventTicketInstanceStatus.VOID) {
      throw new BadRequestException("This ticket is already cancelled");
    }
    instance.status = EventTicketInstanceStatus.VOID;
    const saved = await this.instanceRepo.save(instance);
    return {
      id: saved.id,
      sequence: saved.sequence,
      ticketNumber: saved.ticketNumber,
      ticketTypeName: saved.ticketTypeName,
      status: saved.status,
      redeemedAt: saved.redeemedAt,
    };
  }
}
