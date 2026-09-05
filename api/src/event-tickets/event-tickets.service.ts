import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
import { generateToken, hashToken } from "../auth/token-hash";
import { AppConfig } from "../config/configuration";
import { Event } from "../events/entities/event.entity";
import { EventReviewStatus } from "../events/entities/event.enums";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { CreateEventTicketOrderDto } from "./dto/create-event-ticket-order.dto";
import { CreateTicketTransferDto } from "./dto/create-ticket-transfer.dto";
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
import {
  TicketTransfer,
  TicketTransferStatus,
  transferExpiresAt,
} from "./entities/ticket-transfer.entity";

// The sender's own view of a ticket that currently has (or recently had) an
// outgoing transfer against it — "pending" while the recipient hasn't
// responded yet (QR withheld: see transferTicket's doc comment for why),
// "sent" once they've accepted (the ticket is now genuinely theirs). A
// declined or cancelled transfer leaves no trace here — the ticket simply
// reverts to a normal, un-transferred entry.
export interface TicketTransferInfo {
  transferId: string;
  status: "pending" | "sent";
  toEmail: string;
}

export interface BuyerTicketQr {
  id: string;
  sequence: number;
  ticketNumber: string;
  ticketTypeName: string;
  status: EventTicketInstanceStatus;
  qrDataUrl: string;
  redeemedAt: Date | null;
  transfer?: TicketTransferInfo;
}

export type BuyerEventTicketOrder = EventTicketOrder & {
  tickets: BuyerTicketQr[];
};

// A ticket someone else sent *to* this account and that has since been
// accepted — deliberately not folded into BuyerEventTicketOrder, since the
// order backing it belongs to (and was paid for by) whoever originally
// bought it, not the recipient; showing them that order's payment details
// would leak the original buyer's payment reference/amount for no reason.
export interface ReceivedTicketSummary {
  id: string;
  ticketNumber: string;
  ticketTypeName: string;
  status: EventTicketInstanceStatus;
  qrDataUrl: string;
  redeemedAt: Date | null;
  event: {
    id: string;
    name: string;
    startDate: Date;
    locationText: string | null;
  };
  fromUserName: string;
  transferId: string;
  receivedAt: Date;
}

// A still-open incoming transfer awaiting this account's accept/decline —
// the "My Tickets" page's action-needed list.
export interface PendingTicketTransferSummary {
  id: string;
  ticketInstanceId: string;
  event: { id: string; name: string; startDate: Date };
  ticketTypeName: string;
  fromUserName: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface MyTicketsResponse {
  orders: BuyerEventTicketOrder[];
  receivedTickets: ReceivedTicketSummary[];
  pendingTransfers: PendingTicketTransferSummary[];
}

export interface TicketTransferPreview {
  eventName: string;
  eventStartDate: Date;
  ticketTypeName: string;
  ticketNumber: string;
  fromUserName: string;
  toEmail: string;
  status: TicketTransferStatus;
  expired: boolean;
  // Same meaning as InvitationPreview.requiresAccount: true while
  // toUserId is still unset, meaning the emailed address has no
  // LIBERIA360 account yet — the landing page offers "create account" as
  // well as "log in" in that case.
  requiresAccount: boolean;
}

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

export type TicketSoldOutState = "available" | "almost_sold_out" | "sold_out";

// Per-ticket-type row of the organizer Metrics dashboard. `totalAvailable`/
// `remaining`/`percentSold` are null for a legacy non-typed event with no
// capacity set — there's nothing to divide by, not zero of anything.
export interface TicketTypeMetrics {
  ticketTypeId: string | null;
  name: string;
  totalAvailable: number | null;
  sold: number;
  remaining: number | null;
  cancelled: number;
  revenue: string;
  checkedIn: number;
  notCheckedIn: number;
  percentSold: number | null;
  soldOutState: TicketSoldOutState;
}

// GET /events/:id/ticket-metrics response. A free event (no ticket types,
// no positive ticketPrice) carries `freeEvent` and reports registrations
// via RSVP instead of orders/revenue — there is no paid-ticket data to
// show, and no scan/check-in mechanism for RSVP-only attendance today, so
// this deliberately doesn't fabricate check-in numbers for it.
export interface EventTicketMetrics {
  currency: string;
  isFreeEvent: boolean;
  overview: {
    totalTicketsSold: number;
    totalTicketsRemaining: number | null;
    totalRevenue: string;
    totalOrders: number;
    totalCheckedIn: number;
    totalAttendeesExpected: number;
  };
  byTicketType: TicketTypeMetrics[];
  revenue: {
    gross: string;
    platformFees: string;
    refunds: string;
    net: string;
  };
  orders: {
    totalOrders: number;
    totalTicketsSold: number;
    averageTicketsPerOrder: number;
    largestOrderQuantity: number;
    multiTypeOrders: number;
  };
  attendance: {
    ticketsSold: number;
    checkedIn: number;
    notCheckedIn: number;
    checkInRatePercent: number;
  };
  freeEvent?: {
    totalRegistrations: number;
    remainingCapacity: number | null;
    registrationRatePercent: number | null;
  };
}

@Injectable()
export class EventTicketsService {
  constructor(
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(EventTicketOrder)
    private readonly orderRepo: Repository<EventTicketOrder>,
    @InjectRepository(EventTicketInstance)
    private readonly instanceRepo: Repository<EventTicketInstance>,
    @InjectRepository(TicketTransfer)
    private readonly transferRepo: Repository<TicketTransfer>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService<AppConfig, true>,
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

  // Shared by the buyer's own tickets and a recipient's received tickets:
  // the QR is withheld (empty string) both for a voided ticket (existing
  // behavior) and for one currently in the middle of being sent elsewhere
  // (see transferTicket's doc comment) — `withheld` covers the latter so
  // callers don't need to duplicate that "pending transfer" check.
  private async buildTicketQr(
    instance: EventTicketInstance,
    withheld = false,
  ): Promise<Omit<BuyerTicketQr, "transfer">> {
    let qrDataUrl = "";
    if (instance.status !== EventTicketInstanceStatus.VOID && !withheld) {
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
  }

  // `outgoingTransfers` maps ticketInstanceId -> this buyer's own most
  // recent pending/accepted outgoing transfer for it (see findForBuyer,
  // which is the only caller and the only place that map is built) — a
  // ticket with no entry here was never sent anywhere and serializes
  // exactly as before this feature existed.
  private async serializeBuyerOrder(
    order: EventTicketOrder,
    outgoingTransfers: Map<string, TicketTransfer>,
  ): Promise<BuyerEventTicketOrder> {
    const instances = await this.instanceRepo.find({
      where: { orderId: order.id },
      order: { sequence: "ASC" },
    });
    const tickets = await Promise.all(
      instances.map(async (instance) => {
        const outgoing = outgoingTransfers.get(instance.id);
        const ticket = await this.buildTicketQr(instance, Boolean(outgoing));
        if (!outgoing) return ticket;
        return {
          ...ticket,
          transfer: {
            transferId: outgoing.id,
            status: (outgoing.status === TicketTransferStatus.ACCEPTED
              ? "sent"
              : "pending") as "pending" | "sent",
            toEmail: outgoing.email,
          },
        };
      }),
    );
    return Object.assign(order, { tickets });
  }

  private async serializeOrganizerOrder(
    order: EventTicketOrder,
  ): Promise<OrganizerEventTicketOrder> {
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

  // GET /ticket-orders/mine — three distinct things this account can see:
  // orders it bought (each ticket showing its own send state, if any),
  // tickets someone else sent *to* it that it has accepted, and incoming
  // transfers still awaiting its accept/decline. Deliberately not folded
  // into one flat ticket list — see ReceivedTicketSummary's doc comment
  // for why a received ticket can't just be spliced into its original
  // order (that order's payment details belong to whoever bought it).
  async findForBuyer(userId: string): Promise<MyTicketsResponse> {
    const orders = await this.orderRepo.find({
      where: { buyerUserId: userId },
      order: { createdAt: "DESC" },
    });
    const orderIds = orders.map((order) => order.id);
    const myInstances = orderIds.length
      ? await this.instanceRepo.find({ where: { orderId: In(orderIds) } })
      : [];
    const myInstanceIds = myInstances.map((instance) => instance.id);

    // The most recent pending/accepted transfer THIS account itself sent
    // for each of its own tickets — see serializeBuyerOrder's doc comment
    // for why that's the only lookup needed to know whether (and to whom)
    // one of this buyer's own tickets left their hands.
    const outgoing = myInstanceIds.length
      ? await this.transferRepo.find({
          where: {
            ticketInstanceId: In(myInstanceIds),
            fromUserId: userId,
            status: In([
              TicketTransferStatus.PENDING,
              TicketTransferStatus.ACCEPTED,
            ]),
          },
          order: { createdAt: "DESC" },
        })
      : [];
    const outgoingByInstance = new Map<string, TicketTransfer>();
    for (const transfer of outgoing) {
      if (!outgoingByInstance.has(transfer.ticketInstanceId)) {
        outgoingByInstance.set(transfer.ticketInstanceId, transfer);
      }
    }

    const buyerOrders = await Promise.all(
      orders.map((order) =>
        this.serializeBuyerOrder(order, outgoingByInstance),
      ),
    );

    // Tickets this account now holds because someone else sent them over
    // (excludes an instance from its own order — see the doc comment
    // above on why that case renders through the normal order path
    // instead).
    const receivedInstances = (
      await this.instanceRepo.find({
        where: { currentOwnerUserId: userId },
        relations: { order: true, event: true },
      })
    ).filter((instance) => instance.order.buyerUserId !== userId);
    const receivedIds = receivedInstances.map((instance) => instance.id);
    const incoming = receivedIds.length
      ? await this.transferRepo.find({
          where: {
            ticketInstanceId: In(receivedIds),
            toUserId: userId,
            status: TicketTransferStatus.ACCEPTED,
          },
          order: { createdAt: "DESC" },
        })
      : [];
    const incomingByInstance = new Map<string, TicketTransfer>();
    for (const transfer of incoming) {
      if (!incomingByInstance.has(transfer.ticketInstanceId)) {
        incomingByInstance.set(transfer.ticketInstanceId, transfer);
      }
    }
    const fromUsers = incoming.length
      ? await this.userRepo.find({
          where: { id: In(incoming.map((transfer) => transfer.fromUserId)) },
        })
      : [];
    const fromUserNameById = new Map(
      fromUsers.map((sender) => [sender.id, sender.name]),
    );
    const receivedTickets: ReceivedTicketSummary[] = await Promise.all(
      receivedInstances.map(async (instance) => {
        const transfer = incomingByInstance.get(instance.id);
        const ticket = await this.buildTicketQr(instance);
        return {
          ...ticket,
          event: {
            id: instance.event.id,
            name: instance.event.name,
            startDate: instance.event.startDate,
            locationText: instance.event.locationText,
          },
          fromUserName: transfer
            ? (fromUserNameById.get(transfer.fromUserId) ??
              "A LIBERIA360 traveler")
            : "A LIBERIA360 traveler",
          transferId: transfer?.id ?? "",
          receivedAt: transfer?.respondedAt ?? instance.updatedAt,
        };
      }),
    );

    // Incoming transfers still waiting on this account's accept/decline —
    // the "My Tickets" action-needed list. Resolved via explicit batched
    // lookups (same pattern as receivedTickets above) rather than nested
    // relations, so this stays independent of how deep a single query can
    // eagerly join.
    const pendingRows = (
      await this.transferRepo.find({
        where: { toUserId: userId, status: TicketTransferStatus.PENDING },
        order: { createdAt: "DESC" },
      })
    ).filter((row) => row.expiresAt.getTime() >= Date.now());
    const pendingInstanceIds = pendingRows.map((row) => row.ticketInstanceId);
    const pendingInstances = pendingInstanceIds.length
      ? await this.instanceRepo.find({
          where: { id: In(pendingInstanceIds) },
          relations: { event: true },
        })
      : [];
    const pendingInstanceById = new Map(
      pendingInstances.map((instance) => [instance.id, instance]),
    );
    const pendingSenderIds = [
      ...new Set(pendingRows.map((row) => row.fromUserId)),
    ];
    const pendingSenders = pendingSenderIds.length
      ? await this.userRepo.find({ where: { id: In(pendingSenderIds) } })
      : [];
    const pendingSenderNameById = new Map(
      pendingSenders.map((sender) => [sender.id, sender.name]),
    );
    const pendingTransfers: PendingTicketTransferSummary[] = pendingRows
      .map((row): PendingTicketTransferSummary | null => {
        const instance = pendingInstanceById.get(row.ticketInstanceId);
        if (!instance) return null;
        return {
          id: row.id,
          ticketInstanceId: row.ticketInstanceId,
          event: {
            id: instance.event.id,
            name: instance.event.name,
            startDate: instance.event.startDate,
          },
          ticketTypeName: instance.ticketTypeName,
          fromUserName:
            pendingSenderNameById.get(row.fromUserId) ??
            "A LIBERIA360 traveler",
          createdAt: row.createdAt,
          expiresAt: row.expiresAt,
        };
      })
      .filter((row): row is PendingTicketTransferSummary => row !== null);

    return { orders: buyerOrders, receivedTickets, pendingTransfers };
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
    return saveApproved(this.orderRepo, this.instanceRepo);
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

  // "Buy two, send one" (the AFCON-style feature this whole module exists
  // for): the current holder of an active, unused ticket sends it to
  // anyone by email — same email-only-recipient model as
  // ItinerariesService.createOrResendInvitation (Sep 5, 2026: this
  // originally required an existing account before anything was created;
  // see TicketTransfer's doc comment for why that turned out to be the
  // wrong tradeoff). If the address has no account yet, toUserId is left
  // null and gets linked up later — see linkTicketTransferToNewAccount.
  async transferTicket(
    instanceId: string,
    user: User,
    dto: CreateTicketTransferDto,
  ): Promise<MyTicketsResponse> {
    const instance = await this.instanceRepo.findOne({
      where: { id: instanceId },
      relations: { order: true, event: true },
    });
    if (!instance) throw new NotFoundException("Ticket not found");
    const ownerId = instance.currentOwnerUserId ?? instance.order.buyerUserId;
    if (ownerId !== user.id) {
      throw new ForbiddenException("You don't own this ticket");
    }
    if (instance.status === EventTicketInstanceStatus.REDEEMED) {
      throw new BadRequestException(
        "This ticket has already been used and can't be sent to someone else",
      );
    }
    if (instance.status === EventTicketInstanceStatus.VOID) {
      throw new BadRequestException(
        "This ticket has been cancelled and can't be sent to someone else",
      );
    }

    const email = dto.email.trim().toLowerCase();
    if (email === user.email.toLowerCase()) {
      throw new BadRequestException("You can't send a ticket to yourself");
    }
    const recipient = await this.usersService.findByEmail(email);

    const existing = await this.transferRepo.findOne({
      where: {
        ticketInstanceId: instance.id,
        status: TicketTransferStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `This ticket already has a pending transfer to ${existing.email}. Cancel it before sending it elsewhere.`,
      );
    }

    const token = generateToken();
    const transfer = await this.transferRepo.save(
      this.transferRepo.create({
        ticketInstanceId: instance.id,
        eventId: instance.eventId,
        fromUserId: user.id,
        email,
        toUserId: recipient?.id ?? null,
        tokenHash: hashToken(token),
        status: TicketTransferStatus.PENDING,
        expiresAt: transferExpiresAt(),
      }),
    );
    await this.sendTransferEmail(
      instance,
      transfer,
      token,
      user,
      Boolean(recipient),
    );
    if (recipient) {
      await this.notificationsService.create(recipient.id, {
        type: "ticket.transfer_received",
        title: "Someone sent you a ticket",
        body: `${user.name} sent you a ${instance.ticketTypeName} ticket to ${instance.event.name}.`,
        link: "/account/my-tickets",
      });
    }
    return this.findForBuyer(user.id);
  }

  private async sendTransferEmail(
    instance: EventTicketInstance,
    transfer: TicketTransfer,
    token: string,
    sender: User,
    hasAccount: boolean,
  ): Promise<void> {
    const webAppUrl = this.configService.get("webAppUrl", { infer: true });
    const delivered = await this.mailService.sendTicketTransfer({
      to: transfer.email,
      senderName: sender.name,
      eventName: instance.event.name,
      ticketTypeName: instance.ticketTypeName,
      transferUrl: `${webAppUrl}/ticket-transfer/${token}`,
      hasAccount,
    });
    transfer.emailDelivered = delivered;
    await this.transferRepo.save(transfer);
  }

  /** Links a still-open, email-only ticket transfer to a brand-new
   * account — called from AuthService.register right after account
   * creation, so "click transfer link → create account → land back on the
   * same ticket, already recognized" doesn't need the recipient to hunt
   * down the email again or ask the sender to resend. Never throws:
   * registration must succeed whether or not the transfer token is valid,
   * stale, or already claimed — this only ever silently no-ops instead.
   * Identical contract to ItinerariesService.linkInvitationToNewAccount. */
  async linkTicketTransferToNewAccount(
    token: string,
    newUserId: string,
  ): Promise<void> {
    let transfer: TicketTransfer;
    try {
      transfer = await this.findTransferByToken(token);
    } catch {
      return;
    }
    if (
      transfer.status !== TicketTransferStatus.PENDING ||
      transfer.expiresAt.getTime() < Date.now()
    ) {
      return;
    }
    if (transfer.toUserId && transfer.toUserId !== newUserId) {
      return;
    }
    transfer.toUserId = newUserId;
    await this.transferRepo.save(transfer);
  }

  // Sender-side "I sent it to the wrong person" / "I want it back" escape
  // hatch — only while the recipient hasn't responded yet.
  async cancelTransfer(
    transferId: string,
    user: User,
  ): Promise<MyTicketsResponse> {
    const transfer = await this.transferRepo.findOne({
      where: { id: transferId },
    });
    if (!transfer) throw new NotFoundException("Transfer not found");
    if (transfer.fromUserId !== user.id) {
      throw new ForbiddenException("Only the sender can cancel this transfer");
    }
    if (transfer.status !== TicketTransferStatus.PENDING) {
      throw new BadRequestException("Only a pending transfer can be cancelled");
    }
    transfer.status = TicketTransferStatus.CANCELLED;
    transfer.respondedAt = new Date();
    await this.transferRepo.save(transfer);
    return this.findForBuyer(user.id);
  }

  private async acceptTransferRow(
    user: User,
    transfer: TicketTransfer,
  ): Promise<MyTicketsResponse> {
    if (transfer.toUserId && transfer.toUserId !== user.id) {
      throw new ForbiddenException(
        "This ticket transfer isn't addressed to your account",
      );
    }
    if (transfer.status !== TicketTransferStatus.PENDING) {
      throw new BadRequestException(
        "This ticket transfer is no longer pending",
      );
    }
    if (transfer.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("This ticket transfer has expired");
    }
    const instance = await this.instanceRepo.findOne({
      where: { id: transfer.ticketInstanceId },
      relations: { event: true },
    });
    if (!instance) throw new NotFoundException("This ticket no longer exists");
    if (instance.status !== EventTicketInstanceStatus.ISSUED) {
      throw new BadRequestException(
        "This ticket is no longer available to receive",
      );
    }

    instance.currentOwnerUserId = user.id;
    await this.instanceRepo.save(instance);
    transfer.status = TicketTransferStatus.ACCEPTED;
    transfer.respondedAt = new Date();
    // Whoever accepts while holding the token claims an unlinked
    // (email-only) transfer, same fallback as
    // ItinerariesService.acceptInvitationRow — registering through the
    // emailed link (linkTicketTransferToNewAccount) is the common path,
    // this only matters when the recipient signed up some other way.
    transfer.toUserId = transfer.toUserId ?? user.id;
    await this.transferRepo.save(transfer);

    const sender = await this.usersService.findById(transfer.fromUserId);
    if (sender) {
      const webAppUrl = this.configService.get("webAppUrl", { infer: true });
      await this.mailService
        .sendTicketTransferAccepted(
          sender.email,
          user.name,
          instance.event.name,
          `${webAppUrl}/account/my-tickets`,
        )
        .catch(() => undefined);
      await this.notificationsService.create(sender.id, {
        type: "ticket.transfer_accepted",
        title: "Ticket transfer accepted",
        body: `${user.name} accepted the ticket you sent for ${instance.event.name}.`,
        link: "/account/my-tickets",
      });
    }
    return this.findForBuyer(user.id);
  }

  private async declineTransferRow(
    user: User,
    transfer: TicketTransfer,
  ): Promise<void> {
    if (transfer.toUserId && transfer.toUserId !== user.id) {
      throw new ForbiddenException(
        "This ticket transfer isn't addressed to your account",
      );
    }
    if (transfer.status !== TicketTransferStatus.PENDING) {
      throw new BadRequestException(
        "This ticket transfer is no longer pending",
      );
    }
    transfer.status = TicketTransferStatus.DECLINED;
    transfer.respondedAt = new Date();
    transfer.toUserId = transfer.toUserId ?? user.id;
    await this.transferRepo.save(transfer);
    const sender = await this.usersService.findById(transfer.fromUserId);
    if (sender) {
      await this.notificationsService.create(sender.id, {
        type: "ticket.transfer_declined",
        title: "Ticket transfer declined",
        body: `${user.name} declined the ticket you sent.`,
        link: "/account/my-tickets",
      });
    }
  }

  /** In-app flow: accept/decline a transfer already linked to this account
   * (no token in hand needed). */
  acceptTransferById(
    user: User,
    transferId: string,
  ): Promise<MyTicketsResponse> {
    return this.getTransferOrThrow(transferId).then((row) =>
      this.acceptTransferRow(user, row),
    );
  }

  declineTransferById(user: User, transferId: string): Promise<void> {
    return this.getTransferOrThrow(transferId).then((row) =>
      this.declineTransferRow(user, row),
    );
  }

  private async getTransferOrThrow(
    transferId: string,
  ): Promise<TicketTransfer> {
    const row = await this.transferRepo.findOne({ where: { id: transferId } });
    if (!row) throw new NotFoundException("Transfer not found");
    return row;
  }

  private async findTransferByToken(token: string): Promise<TicketTransfer> {
    const transfer = await this.transferRepo.findOne({
      where: { tokenHash: hashToken(token) },
    });
    if (!transfer) {
      throw new NotFoundException(
        "This ticket transfer link is invalid or has expired",
      );
    }
    return transfer;
  }

  /** GET /ticket-transfers/token/:token — public, unauthenticated preview
   * for the emailed link's landing page. Doesn't require an account to
   * view (only to act on it), mirroring the trip-invitation preview. */
  async getTransferPreview(token: string): Promise<TicketTransferPreview> {
    const transfer = await this.findTransferByToken(token);
    const [instance, sender] = await Promise.all([
      this.instanceRepo.findOne({
        where: { id: transfer.ticketInstanceId },
        relations: { event: true },
      }),
      this.usersService.findById(transfer.fromUserId),
    ]);
    if (!instance) throw new NotFoundException("This ticket no longer exists");
    return {
      eventName: instance.event.name,
      eventStartDate: instance.event.startDate,
      ticketTypeName: instance.ticketTypeName,
      ticketNumber: instance.ticketNumber,
      fromUserName: sender?.name ?? "A LIBERIA360 traveler",
      toEmail: transfer.email,
      status: transfer.status,
      expired: transfer.expiresAt.getTime() < Date.now(),
      requiresAccount: !transfer.toUserId,
    };
  }

  /** Emailed-link flow: accept/decline while holding the token. */
  acceptTransferByToken(user: User, token: string): Promise<MyTicketsResponse> {
    return this.findTransferByToken(token).then((row) =>
      this.acceptTransferRow(user, row),
    );
  }

  declineTransferByToken(user: User, token: string): Promise<void> {
    return this.findTransferByToken(token).then((row) =>
      this.declineTransferRow(user, row),
    );
  }

  // Organizer Metrics dashboard: everything needed to answer "how many
  // sold, how many remain, how much revenue, how many orders, how many
  // checked in" without the organizer ever computing it by hand. Reads
  // straight off approved orders + their ticket instances — there's no
  // separate metrics table to keep in sync, so this is always current as
  // of the moment it's called.
  async getMetrics(eventId: string, user: User): Promise<EventTicketMetrics> {
    const event = await this.getEvent(eventId);
    if (event.createdByUserId !== user.id) {
      throw new ForbiddenException(
        "Only the event organizer can view ticket metrics",
      );
    }

    const currency = event.ticketCurrency || "LRD";
    const isFreeEvent =
      !event.ticketTypes?.length &&
      !(event.ticketPrice && Number(event.ticketPrice) > 0);

    if (isFreeEvent) {
      const totalRegistrations = event.goingCount;
      const remainingCapacity =
        event.ticketCapacity != null
          ? Math.max(0, event.ticketCapacity - totalRegistrations)
          : null;
      const registrationRatePercent = event.ticketCapacity
        ? Math.round((totalRegistrations / event.ticketCapacity) * 100)
        : null;
      return {
        currency,
        isFreeEvent: true,
        overview: {
          totalTicketsSold: totalRegistrations,
          totalTicketsRemaining: remainingCapacity,
          totalRevenue: "0.00",
          totalOrders: 0,
          totalCheckedIn: 0,
          totalAttendeesExpected: totalRegistrations,
        },
        byTicketType: [],
        revenue: {
          gross: "0.00",
          platformFees: "0.00",
          refunds: "0.00",
          net: "0.00",
        },
        orders: {
          totalOrders: 0,
          totalTicketsSold: totalRegistrations,
          averageTicketsPerOrder: 0,
          largestOrderQuantity: 0,
          multiTypeOrders: 0,
        },
        attendance: {
          ticketsSold: totalRegistrations,
          checkedIn: 0,
          notCheckedIn: totalRegistrations,
          checkInRatePercent: 0,
        },
        freeEvent: {
          totalRegistrations,
          remainingCapacity,
          registrationRatePercent,
        },
      };
    }

    const [orders, instances] = await Promise.all([
      this.orderRepo.find({
        where: { eventId, status: EventTicketOrderStatus.APPROVED },
      }),
      this.instanceRepo.find({ where: { eventId } }),
    ]);

    // A legacy non-typed event (single ticketPrice/ticketCapacity, no
    // catalog) is modeled as one implicit "General Admission" type so the
    // same per-type table shape covers both cases.
    const typeCatalog: Array<{
      id: string | null;
      name: string;
      capacity: number | null;
      price: number;
    }> = event.ticketTypes?.length
      ? event.ticketTypes.map((type) => ({
          id: type.id,
          name: type.name,
          capacity: type.quantity ?? null,
          price: Number(type.price) || 0,
        }))
      : [
          {
            id: null,
            name: "General Admission",
            capacity: event.ticketCapacity ?? null,
            price: Number(event.ticketPrice) || 0,
          },
        ];

    // Selling out is judged at 90%+ sold (and not yet literally sold out) —
    // a simple, fixed threshold rather than a per-event setting.
    const ALMOST_SOLD_OUT_THRESHOLD = 90;

    const byTicketType: TicketTypeMetrics[] = typeCatalog.map((type) => {
      const typeInstances = instances.filter(
        (instance) => (instance.ticketTypeId ?? null) === type.id,
      );
      const cancelled = typeInstances.filter(
        (instance) => instance.status === EventTicketInstanceStatus.VOID,
      ).length;
      // A cancelled ticket is treated as never having consumed inventory —
      // it doesn't count toward "sold" or either check-in bucket.
      const active = typeInstances.filter(
        (instance) => instance.status !== EventTicketInstanceStatus.VOID,
      );
      const checkedIn = active.filter(
        (instance) => instance.status === EventTicketInstanceStatus.REDEEMED,
      ).length;
      const sold = active.length;
      const remaining =
        type.capacity != null ? Math.max(0, type.capacity - sold) : null;
      const percentSold =
        type.capacity && type.capacity > 0
          ? Math.round((sold / type.capacity) * 100)
          : null;
      const soldOutState: TicketSoldOutState =
        remaining !== null && remaining <= 0
          ? "sold_out"
          : percentSold !== null && percentSold >= ALMOST_SOLD_OUT_THRESHOLD
            ? "almost_sold_out"
            : "available";
      return {
        ticketTypeId: type.id,
        name: type.name,
        totalAvailable: type.capacity,
        sold,
        remaining,
        cancelled,
        revenue: (sold * type.price).toFixed(2),
        checkedIn,
        notCheckedIn: sold - checkedIn,
        percentSold,
        soldOutState,
      };
    });

    const totalTicketsSold = byTicketType.reduce((sum, t) => sum + t.sold, 0);
    const totalCheckedIn = byTicketType.reduce(
      (sum, t) => sum + t.checkedIn,
      0,
    );
    const gross = byTicketType
      .reduce((sum, t) => sum + Number(t.revenue), 0)
      .toFixed(2);
    const remainingKnownForEveryType = byTicketType.every(
      (t) => t.remaining !== null,
    );
    const totalTicketsRemaining = remainingKnownForEveryType
      ? byTicketType.reduce((sum, t) => sum + (t.remaining ?? 0), 0)
      : null;

    const totalOrders = orders.length;
    const averageTicketsPerOrder =
      totalOrders > 0 ? Number((totalTicketsSold / totalOrders).toFixed(2)) : 0;
    const largestOrderQuantity = orders.reduce(
      (max, order) => Math.max(max, order.quantity),
      0,
    );
    const multiTypeOrders = orders.filter(
      (order) =>
        new Set((order.items || []).map((item) => item.ticketTypeId)).size > 1,
    ).length;

    const notCheckedIn = totalTicketsSold - totalCheckedIn;
    const checkInRatePercent =
      totalTicketsSold > 0
        ? Math.round((totalCheckedIn / totalTicketsSold) * 100)
        : 0;

    return {
      currency,
      isFreeEvent: false,
      overview: {
        totalTicketsSold,
        totalTicketsRemaining,
        totalRevenue: gross,
        totalOrders,
        totalCheckedIn,
        totalAttendeesExpected: totalTicketsSold,
      },
      byTicketType,
      // No platform-fee or refund tracking exists yet — both are always
      // zero today, which keeps net === gross rather than implying
      // deductions that were never actually taken.
      revenue: { gross, platformFees: "0.00", refunds: "0.00", net: gross },
      orders: {
        totalOrders,
        totalTicketsSold,
        averageTicketsPerOrder,
        largestOrderQuantity,
        multiTypeOrders,
      },
      attendance: {
        ticketsSold: totalTicketsSold,
        checkedIn: totalCheckedIn,
        notCheckedIn,
        checkInRatePercent,
      },
    };
  }
}
