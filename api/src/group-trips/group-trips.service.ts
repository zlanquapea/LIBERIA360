import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as QRCode from "qrcode";
import { EntityManager, In, Repository } from "typeorm";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import {
  CollaboratorRole,
  TripVisibility,
} from "../itineraries/entities/itinerary.enums";
import type { NotificationType } from "../notifications/entities/notification.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { TripChatService } from "../trip-chat/trip-chat.service";
import {
  BoardTripDto,
  BookTripDto,
  HostingDto,
  TripPaymentDto,
} from "./dto/group-trips.dto";
import {
  ACTIVE_TRIP_BOOKING_STATUSES,
  HOLDING_TRIP_BOOKING_STATUSES,
  TripBookingPaymentStatus,
  TripBookingStatus,
  TripPaymentMethod,
  TripPaymentPlan,
  TripPaymentRecordStatus,
} from "./entities/group-trip.enums";
import { HostedTrip } from "./entities/hosted-trip.entity";
import { TripBookingPayment } from "./entities/trip-booking-payment.entity";
import { TripBooking } from "./entities/trip-booking.entity";
import {
  amountToHold,
  outstanding,
  paymentStatusFor,
  round2,
  spotsLeft,
  ticketQrPayload,
  todayInLiberia,
  tripBookingCode,
} from "./group-trip-money";

type Role = "traveller" | "host";

const METHOD_LABELS: Record<TripPaymentMethod, string> = {
  [TripPaymentMethod.CASH]: "cash",
  [TripPaymentMethod.MTN_MOMO]: "MTN MoMo",
  [TripPaymentMethod.ORANGE_MONEY]: "Orange Money",
};

const clean = (list: string[] | undefined) => [
  ...new Set((list ?? []).map((s) => s.trim()).filter(Boolean)),
];

const blank = (s: string | null | undefined) => s?.trim() || null;

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const spotsWord = (n: number) => (n === 1 ? "1 spot" : `${n} spots`);

/**
 * Organised group trips: an organiser opens their trip for bookings, free
 * or paid, and travellers book spots for themselves and their friends.
 * Payment works the Liberian way — cash to the organiser, MTN MoMo or
 * Orange Money — in full or with a deposit first. A confirmed traveller
 * joins the trip itself (its plan and group chat), and on departure day
 * the organiser ticks everyone onto the bus from the passenger list or
 * by scanning their ticket.
 */
@Injectable()
export class GroupTripsService {
  constructor(
    @InjectRepository(HostedTrip)
    private readonly hosted: Repository<HostedTrip>,
    @InjectRepository(TripBooking)
    private readonly bookings: Repository<TripBooking>,
    @InjectRepository(TripBookingPayment)
    private readonly payments: Repository<TripBookingPayment>,
    @InjectRepository(Itinerary)
    private readonly itineraries: Repository<Itinerary>,
    @InjectRepository(ItineraryCollaborator)
    private readonly collaborators: Repository<ItineraryCollaborator>,
    private readonly notifications: NotificationsService,
    private readonly tripChat: TripChatService,
  ) {}

  // -------------------------------------------------------------------
  // What everyone sees
  // -------------------------------------------------------------------

  async isHosted(itineraryId: string) {
    return this.hosted.exists({ where: { itineraryId } });
  }

  /** The trip's hosting details with live spot counts, or null when the
   * trip isn't an organised one. */
  async hostingFor(itineraryId: string) {
    return (await this.hostingForMany([itineraryId])).get(itineraryId) ?? null;
  }

  async hostingForMany(itineraryIds: string[]) {
    const out = new Map<string, ReturnType<GroupTripsService["hostingView"]>>();
    if (!itineraryIds.length) return out;
    const rows = await this.hosted.find({
      where: { itineraryId: In(itineraryIds) },
    });
    if (!rows.length) return out;
    const counts = await this.seatCounts(rows.map((r) => r.itineraryId));
    for (const row of rows)
      out.set(
        row.itineraryId,
        this.hostingView(row, counts.get(row.itineraryId)),
      );
    return out;
  }

  private async seatCounts(itineraryIds: string[], manager?: EntityManager) {
    const repo = manager ? manager.getRepository(TripBooking) : this.bookings;
    const rows: Array<{
      id: string;
      status: TripBookingStatus;
      seats: string;
    }> = await repo
      .createQueryBuilder("b")
      .select("b.itinerary_id", "id")
      .addSelect("b.status", "status")
      .addSelect("COALESCE(SUM(b.seats), 0)", "seats")
      .where("b.itinerary_id IN (:...ids)", { ids: itineraryIds })
      .andWhere("b.status IN (:...statuses)", {
        statuses: ACTIVE_TRIP_BOOKING_STATUSES,
      })
      .groupBy("b.itinerary_id")
      .addGroupBy("b.status")
      .getRawMany();
    const out = new Map<
      string,
      { confirmed: number; pending: number; waitlisted: number }
    >();
    for (const r of rows) {
      const c = out.get(r.id) ?? { confirmed: 0, pending: 0, waitlisted: 0 };
      if (r.status === TripBookingStatus.CONFIRMED)
        c.confirmed = Number(r.seats);
      if (r.status === TripBookingStatus.PENDING) c.pending = Number(r.seats);
      if (r.status === TripBookingStatus.WAITLISTED)
        c.waitlisted = Number(r.seats);
      out.set(r.id, c);
    }
    return out;
  }

  private hostingView(
    h: HostedTrip,
    counts = { confirmed: 0, pending: 0, waitlisted: 0 },
  ) {
    return {
      open: h.open,
      tagline: h.tagline,
      price: h.price,
      currency: h.currency,
      isFree: h.price === 0,
      depositAmount: h.depositAmount,
      balanceDueDate: h.balanceDueDate,
      bookingDeadline: h.bookingDeadline,
      spots: h.spots,
      spotsBooked: counts.confirmed,
      spotsHeld: counts.pending,
      spotsLeft: spotsLeft(h.spots, counts.confirmed + counts.pending),
      waitlisted: counts.waitlisted,
      maxPerBooking: h.maxPerBooking,
      requireApproval: h.requireApproval,
      includes: h.includes,
      excludes: h.excludes,
      activities: h.activities,
      meetingPoint: h.meetingPoint,
      departureTime: h.departureTime,
      organisers: h.organisers,
      gallery: h.gallery,
      goodToKnow: h.goodToKnow,
      contactPhone: h.contactPhone,
      cashEnabled: h.cashEnabled,
      mtnMomoNumber: h.mtnMomoNumber,
      orangeMoneyNumber: h.orangeMoneyNumber,
      accountName: h.accountName,
      paymentOptions: this.paymentOptions(h),
    };
  }

  private paymentOptions(h: HostedTrip) {
    const out: Array<{ method: TripPaymentMethod; account: string | null }> =
      [];
    if (h.cashEnabled)
      out.push({ method: TripPaymentMethod.CASH, account: null });
    if (h.mtnMomoNumber)
      out.push({
        method: TripPaymentMethod.MTN_MOMO,
        account: h.mtnMomoNumber,
      });
    if (h.orangeMoneyNumber)
      out.push({
        method: TripPaymentMethod.ORANGE_MONEY,
        account: h.orangeMoneyNumber,
      });
    return out;
  }

  private account(h: HostedTrip, method: TripPaymentMethod) {
    if (method === TripPaymentMethod.MTN_MOMO) return h.mtnMomoNumber;
    if (method === TripPaymentMethod.ORANGE_MONEY) return h.orangeMoneyNumber;
    return null;
  }

  private accepts(h: HostedTrip, method: TripPaymentMethod) {
    return method === TripPaymentMethod.CASH
      ? h.cashEnabled
      : Boolean(this.account(h, method));
  }

  // -------------------------------------------------------------------
  // Organiser: set up
  // -------------------------------------------------------------------

  async saveHosting(userId: string, itineraryId: string, dto: HostingDto) {
    const trip = await this.ownedTrip(userId, itineraryId);
    if (trip.cancelledAt)
      throw new BadRequestException("This trip has been cancelled");
    if (trip.isFeaturedTemplate)
      throw new BadRequestException(
        "Trip ideas can't take bookings — duplicate it and host the copy",
      );
    if (!trip.startDate)
      throw new BadRequestException(
        "Set the trip's dates before opening it for bookings",
      );

    const price = round2(dto.price);
    const mtn = blank(dto.mtnMomoNumber);
    const orange = blank(dto.orangeMoneyNumber);
    const accountName = blank(dto.accountName);
    const cashEnabled = dto.cashEnabled ?? true;
    let deposit =
      dto.depositAmount == null ? null : round2(dto.depositAmount) || null;
    if (price === 0) deposit = null;
    if (price > 0 && !cashEnabled && !mtn && !orange)
      throw new BadRequestException(
        "Turn on at least one way for travellers to pay",
      );
    if ((mtn || orange) && !accountName)
      throw new BadRequestException(
        "Add the name on your mobile money account so travellers know it's you",
      );
    if (deposit != null && deposit >= price)
      throw new BadRequestException("The deposit must be less than the price");
    const start = dateOnly(trip.startDate)!;
    if (dto.bookingDeadline && dto.bookingDeadline > start)
      throw new BadRequestException(
        "Bookings must close on or before the day the trip leaves",
      );
    if (dto.balanceDueDate && dto.balanceDueDate > start)
      throw new BadRequestException(
        "The balance must be due on or before the day the trip leaves",
      );

    const counts = (await this.seatCounts([itineraryId])).get(itineraryId);
    const held = (counts?.confirmed ?? 0) + (counts?.pending ?? 0);
    if (dto.spots < held)
      throw new BadRequestException(
        `${spotsWord(held)} already booked — you can't offer fewer than that`,
      );

    const row =
      (await this.hosted.findOne({ where: { itineraryId } })) ??
      this.hosted.create({ itineraryId });
    Object.assign(row, {
      open: dto.open ?? row.open ?? true,
      tagline: blank(dto.tagline),
      price,
      currency: dto.currency,
      depositAmount: deposit,
      balanceDueDate: deposit != null ? (dto.balanceDueDate ?? null) : null,
      bookingDeadline: dto.bookingDeadline ?? null,
      spots: dto.spots,
      maxPerBooking: dto.maxPerBooking ?? row.maxPerBooking ?? 6,
      requireApproval: price === 0 ? (dto.requireApproval ?? false) : false,
      includes: clean(dto.includes),
      excludes: clean(dto.excludes),
      activities: clean(dto.activities),
      meetingPoint: blank(dto.meetingPoint),
      departureTime: dto.departureTime ?? null,
      organisers: (dto.organisers ?? [])
        .map((o) => ({ name: o.name.trim(), logo: blank(o.logo) }))
        .filter((o) => o.name),
      gallery: clean(dto.gallery),
      goodToKnow: blank(dto.goodToKnow),
      contactPhone: blank(dto.contactPhone),
      cashEnabled,
      mtnMomoNumber: mtn,
      orangeMoneyNumber: orange,
      accountName,
    });
    await this.hosted.save(row);

    trip.visibility = TripVisibility.PUBLIC;
    if (dto.coverImage !== undefined) trip.coverImage = blank(dto.coverImage);
    await this.itineraries.save(trip);
    return this.hostingFor(itineraryId);
  }

  /** The organiser's trip desk: spots, money and every booking. */
  async desk(userId: string, itineraryId: string) {
    const trip = await this.ownedTrip(userId, itineraryId);
    const hosting = await this.hostingFor(itineraryId);
    const list = await this.bookings.find({
      where: { itineraryId },
      relations: { payments: true },
      order: { createdAt: "DESC" },
    });
    const holding = list.filter((b) =>
      HOLDING_TRIP_BOOKING_STATUSES.includes(b.status),
    );
    const confirmed = list.filter(
      (b) => b.status === TripBookingStatus.CONFIRMED,
    );
    const stats = {
      travellers: confirmed.reduce((n, b) => n + b.seats, 0),
      boarded: confirmed.reduce(
        (n, b) => n + b.travellers.filter((t) => t.boarded).length,
        0,
      ),
      collected: round2(
        list
          .filter((b) => b.paymentStatus !== TripBookingPaymentStatus.REFUNDED)
          .reduce((n, b) => n + b.amountPaid, 0),
      ),
      expected: round2(holding.reduce((n, b) => n + b.totalAmount, 0)),
      outstanding: round2(holding.reduce((n, b) => n + outstanding(b), 0)),
      paymentsToCheck: list.reduce(
        (n, b) =>
          n +
          b.payments.filter(
            (p) => p.status === TripPaymentRecordStatus.AWAITING_VERIFICATION,
          ).length,
        0,
      ),
      refundsDue: list.filter(
        (b) => b.paymentStatus === TripBookingPaymentStatus.REFUND_DUE,
      ).length,
    };
    return {
      trip: this.tripSummary(trip),
      hosting,
      stats,
      bookings: await Promise.all(list.map((b) => this.view(b, "host", trip))),
    };
  }

  // -------------------------------------------------------------------
  // Traveller: book and pay
  // -------------------------------------------------------------------

  async book(userId: string, itineraryId: string, dto: BookTripDto) {
    const trip = await this.itineraries.findOne({ where: { id: itineraryId } });
    const hosting = await this.hosted.findOne({ where: { itineraryId } });
    if (!trip || !hosting || trip.visibility !== TripVisibility.PUBLIC)
      throw new NotFoundException("This trip isn't taking bookings");
    if (trip.cancelledAt)
      throw new BadRequestException("This trip has been cancelled");
    if (trip.userId === userId)
      throw new BadRequestException("You're the organiser of this trip");
    if (!hosting.open)
      throw new BadRequestException(
        "The organiser has closed bookings for this trip",
      );
    const today = todayInLiberia();
    const start = dateOnly(trip.startDate);
    if (start && start < today)
      throw new BadRequestException("This trip has already left");
    if (hosting.bookingDeadline && hosting.bookingDeadline < today)
      throw new BadRequestException("Bookings for this trip have closed");
    if (dto.seats > hosting.maxPerBooking)
      throw new BadRequestException(
        `You can book up to ${spotsWord(hosting.maxPerBooking)} at a time`,
      );
    const names = dto.travellers.map((n) => n.trim());
    if (names.length !== dto.seats || names.some((n) => !n))
      throw new BadRequestException("Add a name for everyone travelling");
    if (
      await this.bookings.exists({
        where: {
          itineraryId,
          userId,
          status: In(ACTIVE_TRIP_BOOKING_STATUSES),
        },
      })
    )
      throw new ConflictException(
        "You already have a booking on this trip — open it from My trip bookings",
      );

    const free = hosting.price === 0;
    const waitlist = Boolean(dto.joinWaitlist);
    const reference = dto.paymentReference?.trim() || null;
    let method: TripPaymentMethod | null = null;
    let plan = TripPaymentPlan.FULL;
    if (waitlist && reference)
      throw new BadRequestException(
        "Join the waitlist without paying — you'll pay once you get a spot",
      );
    if (!free && !waitlist) {
      if (!dto.paymentMethod)
        throw new BadRequestException("Choose how you'll pay");
      method = dto.paymentMethod;
      if (!this.accepts(hosting, method))
        throw new BadRequestException(
          `The organiser doesn't take ${METHOD_LABELS[method]} for this trip`,
        );
      plan = dto.paymentPlan ?? TripPaymentPlan.FULL;
      if (plan === TripPaymentPlan.DEPOSIT && hosting.depositAmount == null)
        throw new BadRequestException("This trip doesn't take deposits");
      if (method !== TripPaymentMethod.CASH && !reference)
        throw new BadRequestException(
          "Enter the transaction ID from your mobile money SMS",
        );
    }

    const total = round2(hosting.price * dto.seats);
    const deposit =
      plan === TripPaymentPlan.DEPOSIT
        ? round2(hosting.depositAmount! * dto.seats)
        : null;

    let saved: TripBooking;
    try {
      saved = await this.bookings.manager.transaction(async (manager) => {
        // One booking at a time per trip, so two people can never both
        // take the last spot.
        await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          itineraryId,
        ]);
        const c = (await this.seatCounts([itineraryId], manager)).get(
          itineraryId,
        );
        const left = spotsLeft(
          hosting.spots,
          (c?.confirmed ?? 0) + (c?.pending ?? 0),
        );
        const fits = dto.seats <= left;
        if (!fits && !waitlist)
          throw new ConflictException(
            left === 0
              ? "This trip is full — join the waitlist and the organiser can give you a spot if one opens"
              : `Only ${spotsWord(left)} left — book fewer spots or join the waitlist`,
          );
        const status = !fits
          ? TripBookingStatus.WAITLISTED
          : free && !hosting.requireApproval
            ? TripBookingStatus.CONFIRMED
            : TripBookingStatus.PENDING;
        const booking = await manager.save(
          TripBooking,
          manager.create(TripBooking, {
            code: await this.freshCode(manager),
            itineraryId,
            hostUserId: trip.userId,
            userId,
            status,
            seats: dto.seats,
            travellers: names.map((name) => ({ name, boarded: false })),
            contactName: dto.contactName.trim(),
            phone: dto.phone.trim(),
            notes: dto.notes?.trim() || null,
            unitPrice: hosting.price,
            totalAmount: total,
            currency: hosting.currency,
            depositAmount: deposit,
            paymentPlan: plan,
            paymentMethod: fits ? method : null,
            amountPaid: 0,
            paymentStatus: free
              ? TripBookingPaymentStatus.FREE
              : TripBookingPaymentStatus.UNPAID,
            confirmedAt:
              status === TripBookingStatus.CONFIRMED ? new Date() : null,
          }),
        );
        if (fits && method && method !== TripPaymentMethod.CASH)
          await manager.save(
            TripBookingPayment,
            manager.create(TripBookingPayment, {
              bookingId: booking.id,
              amount: deposit ?? total,
              method,
              reference,
              account: this.account(hosting, method),
              status: TripPaymentRecordStatus.AWAITING_VERIFICATION,
            }),
          );
        return booking;
      });
    } catch (e) {
      this.rethrowDuplicateReference(e);
      throw e;
    }

    if (saved.status === TripBookingStatus.CONFIRMED)
      await this.addMember(saved, trip);
    const who = `${saved.contactName} (${spotsWord(saved.seats)})`;
    await this.notify(trip.userId, {
      type:
        saved.status === TripBookingStatus.WAITLISTED
          ? "trip_booking.updated"
          : "trip_booking.requested",
      title:
        saved.status === TripBookingStatus.WAITLISTED
          ? "Someone joined your waitlist"
          : saved.status === TripBookingStatus.CONFIRMED
            ? "New traveller booked"
            : method && method !== TripPaymentMethod.CASH
              ? "New booking — payment to check"
              : "New booking to confirm",
      body: `${who} on "${trip.title}".`,
      link: this.hostLink(saved),
    });
    return this.get(userId, saved.id);
  }

  async mine(userId: string) {
    const list = await this.bookings.find({
      where: { userId },
      relations: { payments: true, itinerary: true },
      order: { createdAt: "DESC" },
    });
    return Promise.all(list.map((b) => this.view(b, "traveller", b.itinerary)));
  }

  /** The signed-in traveller's latest booking on one trip, if any — what
   * the trip page shows instead of a second "Book" button. */
  async myBookingFor(userId: string, itineraryId: string) {
    const b = await this.bookings.findOne({
      where: { userId, itineraryId },
      order: { createdAt: "DESC" },
    });
    return b ? this.get(userId, b.id) : null;
  }

  async get(userId: string, bookingId: string) {
    const b = await this.load(bookingId);
    const role = this.roleOf(b, userId);
    return this.view(b, role, b.itinerary);
  }

  async pay(userId: string, bookingId: string, dto: TripPaymentDto) {
    const b = await this.load(bookingId);
    const role = this.roleOf(b, userId);
    if (b.status === TripBookingStatus.WAITLISTED)
      throw new BadRequestException(
        "You're on the waitlist — pay once the organiser gives you a spot",
      );
    if (!HOLDING_TRIP_BOOKING_STATUSES.includes(b.status))
      throw new BadRequestException("This booking is no longer active");
    if (b.totalAmount === 0) throw new BadRequestException("This trip is free");
    const owed = outstanding(b);
    if (owed === 0)
      throw new BadRequestException("This booking is already paid in full");
    const amount = round2(dto.amount);
    if (amount > owed)
      throw new BadRequestException(
        `Only ${owed} ${b.currency} is still owed on this booking`,
      );
    const hosting = await this.hosted.findOne({
      where: { itineraryId: b.itineraryId },
    });
    const reference = dto.reference?.trim() || null;

    if (role === "traveller") {
      if (dto.method === TripPaymentMethod.CASH)
        throw new BadRequestException(
          "Hand cash to the organiser — they'll record it for you",
        );
      if (!hosting || !this.accepts(hosting, dto.method))
        throw new BadRequestException(
          `The organiser doesn't take ${METHOD_LABELS[dto.method]} for this trip`,
        );
      if (!reference)
        throw new BadRequestException(
          "Enter the transaction ID from your mobile money SMS",
        );
      try {
        await this.payments.save(
          this.payments.create({
            bookingId: b.id,
            amount,
            method: dto.method,
            reference,
            account: this.account(hosting, dto.method),
            status: TripPaymentRecordStatus.AWAITING_VERIFICATION,
          }),
        );
      } catch (e) {
        this.rethrowDuplicateReference(e);
        throw e;
      }
      await this.bookings.update(b.id, { paymentMethod: dto.method });
      await this.notify(b.hostUserId, {
        type: "trip_booking.payment",
        title: "Payment to check",
        body: `${b.contactName} sent ${amount} ${b.currency} by ${METHOD_LABELS[dto.method]} for "${b.itinerary.title}".`,
        link: this.hostLink(b),
      });
    } else {
      // The organiser recording money they took in hand (or found
      // themselves) — it counts straight away.
      try {
        await this.payments.save(
          this.payments.create({
            bookingId: b.id,
            amount,
            method: dto.method,
            reference,
            account: hosting ? this.account(hosting, dto.method) : null,
            status: TripPaymentRecordStatus.RECEIVED,
            recordedByHost: true,
            verifiedAt: new Date(),
          }),
        );
      } catch (e) {
        this.rethrowDuplicateReference(e);
        throw e;
      }
      await this.settle(b.id, amount);
    }
    return this.get(userId, b.id);
  }

  // -------------------------------------------------------------------
  // Organiser: run the bookings
  // -------------------------------------------------------------------

  async reviewPayment(
    userId: string,
    bookingId: string,
    paymentId: string,
    received: boolean,
  ) {
    const b = await this.hostBooking(userId, bookingId);
    const payment = b.payments.find((p) => p.id === paymentId);
    if (!payment) throw new NotFoundException("Payment not found");
    const result = await this.payments.update(
      {
        id: paymentId,
        status: TripPaymentRecordStatus.AWAITING_VERIFICATION,
      },
      {
        status: received
          ? TripPaymentRecordStatus.RECEIVED
          : TripPaymentRecordStatus.REJECTED,
        verifiedAt: new Date(),
      },
    );
    if (!result.affected)
      throw new ConflictException("That payment has already been checked");
    if (received) await this.settle(b.id, payment.amount);
    else
      await this.notify(b.userId, {
        type: "trip_booking.updated",
        title: "We couldn't find your payment",
        body: `The organiser of "${b.itinerary.title}" couldn't find your ${METHOD_LABELS[payment.method]} payment (${payment.reference ?? "no ID"}). Check the transaction ID and send it again.`,
        link: this.travellerLink(b),
      });
    return this.get(userId, b.id);
  }

  async confirm(userId: string, bookingId: string, note?: string) {
    const b = await this.hostBooking(userId, bookingId);
    if (b.status !== TripBookingStatus.PENDING)
      throw new BadRequestException(
        "Only bookings waiting for you can be confirmed",
      );
    await this.move(
      b,
      [TripBookingStatus.PENDING],
      TripBookingStatus.CONFIRMED,
      {
        confirmedAt: new Date(),
        hostNote: note?.trim() || b.hostNote,
      },
    );
    await this.addMember(b, b.itinerary);
    await this.notify(b.userId, {
      type: "trip_booking.confirmed",
      title: "You're going! 🎉",
      body: `Your ${spotsWord(b.seats)} on "${b.itinerary.title}" ${b.seats === 1 ? "is" : "are"} confirmed.${outstanding(b) > 0 ? ` ${outstanding(b)} ${b.currency} is still to pay.` : ""}`,
      link: this.travellerLink(b),
    });
    return this.get(userId, b.id);
  }

  async decline(userId: string, bookingId: string, note?: string) {
    const b = await this.hostBooking(userId, bookingId);
    const from = [TripBookingStatus.PENDING, TripBookingStatus.WAITLISTED];
    if (!from.includes(b.status))
      throw new BadRequestException(
        "Only bookings waiting for you can be declined — cancel a confirmed one instead",
      );
    await this.move(b, from, TripBookingStatus.DECLINED, {
      hostNote: note?.trim() || null,
      cancelledAt: new Date(),
    });
    await this.recompute(b.id);
    await this.notify(b.userId, {
      type: "trip_booking.cancelled",
      title: "Booking not accepted",
      body: `The organiser of "${b.itinerary.title}" couldn't take your booking.${note?.trim() ? ` "${note.trim()}"` : ""}${b.amountPaid > 0 ? " Your payment will be refunded." : ""}`,
      link: this.travellerLink(b),
    });
    if (b.status === TripBookingStatus.PENDING) await this.spotsFreed(b);
    return this.get(userId, b.id);
  }

  /** Give a waitlisted booking a spot that has opened up. */
  async promote(userId: string, bookingId: string) {
    const b = await this.hostBooking(userId, bookingId);
    if (b.status !== TripBookingStatus.WAITLISTED)
      throw new BadRequestException("This booking isn't on the waitlist");
    const hosting = await this.hosted.findOneOrFail({
      where: { itineraryId: b.itineraryId },
    });
    const free = b.totalAmount === 0;
    const next =
      free && !hosting.requireApproval
        ? TripBookingStatus.CONFIRMED
        : TripBookingStatus.PENDING;
    await this.bookings.manager.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        b.itineraryId,
      ]);
      const c = (await this.seatCounts([b.itineraryId], manager)).get(
        b.itineraryId,
      );
      const left = spotsLeft(
        hosting.spots,
        (c?.confirmed ?? 0) + (c?.pending ?? 0),
      );
      if (b.seats > left)
        throw new ConflictException(
          `Only ${spotsWord(left)} free — this booking needs ${b.seats}`,
        );
      const result = await manager.update(
        TripBooking,
        { id: b.id, status: TripBookingStatus.WAITLISTED },
        {
          status: next,
          confirmedAt: next === TripBookingStatus.CONFIRMED ? new Date() : null,
        },
      );
      if (!result.affected)
        throw new ConflictException("This booking has just changed");
    });
    if (next === TripBookingStatus.CONFIRMED)
      await this.addMember(b, b.itinerary);
    await this.notify(b.userId, {
      type: "trip_booking.updated",
      title: "A spot opened up for you",
      body:
        next === TripBookingStatus.CONFIRMED
          ? `You're off the waitlist and going on "${b.itinerary.title}".`
          : `You're off the waitlist for "${b.itinerary.title}". Pay now to secure your ${spotsWord(b.seats)}.`,
      link: this.travellerLink(b),
    });
    return this.get(userId, b.id);
  }

  async cancel(userId: string, bookingId: string, reason?: string) {
    const b = await this.load(bookingId);
    const role = this.roleOf(b, userId);
    if (!ACTIVE_TRIP_BOOKING_STATUSES.includes(b.status))
      throw new BadRequestException("This booking is already closed");
    const wasHolding = HOLDING_TRIP_BOOKING_STATUSES.includes(b.status);
    await this.move(
      b,
      ACTIVE_TRIP_BOOKING_STATUSES,
      TripBookingStatus.CANCELLED,
      {
        cancelledAt: new Date(),
        ...(role === "host" ? { hostNote: reason?.trim() || null } : {}),
      },
    );
    await this.recompute(b.id);
    await this.removeMember(b);
    const paid = b.amountPaid > 0 ? " A refund is due." : "";
    if (role === "traveller")
      await this.notify(b.hostUserId, {
        type: "trip_booking.cancelled",
        title: "A traveller cancelled",
        body: `${b.contactName} cancelled ${spotsWord(b.seats)} on "${b.itinerary.title}".${paid}`,
        link: this.hostLink(b),
      });
    else
      await this.notify(b.userId, {
        type: "trip_booking.cancelled",
        title: "Your booking was cancelled",
        body: `The organiser cancelled your booking on "${b.itinerary.title}".${reason?.trim() ? ` "${reason.trim()}"` : ""}${b.amountPaid > 0 ? " They'll refund what you paid." : ""}`,
        link: this.travellerLink(b),
      });
    if (wasHolding) await this.spotsFreed(b);
    return this.get(userId, b.id);
  }

  async board(userId: string, bookingId: string, dto: BoardTripDto) {
    const b = await this.hostBooking(userId, bookingId);
    if (b.status !== TripBookingStatus.CONFIRMED)
      throw new BadRequestException("Only confirmed travellers can board");
    if (dto.traveller != null && dto.traveller >= b.travellers.length)
      throw new BadRequestException("That traveller isn't on this booking");
    const travellers = b.travellers.map((t, i) =>
      dto.traveller == null || dto.traveller === i
        ? { ...t, boarded: dto.boarded }
        : t,
    );
    await this.bookings.update(b.id, { travellers });
    return this.get(userId, b.id);
  }

  async markRefunded(userId: string, bookingId: string) {
    const b = await this.hostBooking(userId, bookingId);
    if (b.paymentStatus !== TripBookingPaymentStatus.REFUND_DUE)
      throw new BadRequestException("No refund is due on this booking");
    await this.bookings.update(b.id, {
      paymentStatus: TripBookingPaymentStatus.REFUNDED,
    });
    await this.notify(b.userId, {
      type: "trip_booking.updated",
      title: "Refund sent",
      body: `The organiser of "${b.itinerary.title}" has refunded ${b.amountPaid} ${b.currency}.`,
      link: this.travellerLink(b),
    });
    return this.get(userId, b.id);
  }

  // -------------------------------------------------------------------
  // Called by the trip itself
  // -------------------------------------------------------------------

  /** The organiser cancelled the whole trip: every booking ends, and
   * anyone who paid is owed a refund. */
  async onTripCancelled(itineraryId: string) {
    await this.hosted.update({ itineraryId }, { open: false });
    const list = await this.bookings.find({
      where: { itineraryId, status: In(ACTIVE_TRIP_BOOKING_STATUSES) },
      relations: { itinerary: true },
    });
    for (const b of list) {
      await this.bookings.update(b.id, {
        status: TripBookingStatus.CANCELLED,
        cancelledAt: new Date(),
      });
      await this.recompute(b.id);
      await this.notify(b.userId, {
        type: "trip_booking.cancelled",
        title: "Trip cancelled",
        body: `"${b.itinerary.title}" has been cancelled by the organiser.${b.amountPaid > 0 ? " They'll refund what you paid." : ""}`,
        link: this.travellerLink(b),
      });
    }
  }

  /** Deleting a trip would erase its bookings, so it waits until nobody
   * is booked and every refund is done. */
  async assertDeletable(itineraryId: string) {
    const blocking = await this.bookings.find({
      where: [
        { itineraryId, status: In(ACTIVE_TRIP_BOOKING_STATUSES) },
        { itineraryId, paymentStatus: TripBookingPaymentStatus.REFUND_DUE },
      ],
      take: 1,
    });
    if (!blocking.length) return;
    throw new ConflictException(
      ACTIVE_TRIP_BOOKING_STATUSES.includes(blocking[0].status)
        ? "Travellers have booked this trip. Cancel the trip first so everyone is told and refunds are tracked."
        : "Mark every refund as done before deleting this trip.",
    );
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  private async ownedTrip(userId: string, itineraryId: string) {
    const trip = await this.itineraries.findOne({ where: { id: itineraryId } });
    if (!trip || trip.userId !== userId)
      throw new NotFoundException("Trip not found");
    return trip;
  }

  private async load(bookingId: string) {
    const b = await this.bookings.findOne({
      where: { id: bookingId },
      relations: { payments: true, itinerary: true },
    });
    if (!b) throw new NotFoundException("Booking not found");
    return b;
  }

  private roleOf(b: TripBooking, userId: string): Role {
    if (b.hostUserId === userId) return "host";
    if (b.userId === userId) return "traveller";
    throw new NotFoundException("Booking not found");
  }

  private async hostBooking(userId: string, bookingId: string) {
    const b = await this.load(bookingId);
    if (b.hostUserId !== userId)
      throw new NotFoundException("Booking not found");
    return b;
  }

  private async move(
    b: TripBooking,
    from: TripBookingStatus[],
    to: TripBookingStatus,
    extra: Partial<TripBooking> = {},
  ) {
    const result = await this.bookings.update(
      { id: b.id, status: In(from) },
      { status: to, ...extra },
    );
    if (!result.affected)
      throw new ConflictException("This booking has just changed — refresh");
  }

  /** Re-add what's been received and work out the money status again. */
  private async recompute(bookingId: string) {
    const b = await this.bookings.findOneOrFail({
      where: { id: bookingId },
      relations: { payments: true },
    });
    const paid = round2(
      b.payments
        .filter((p) => p.status === TripPaymentRecordStatus.RECEIVED)
        .reduce((n, p) => n + p.amount, 0),
    );
    const paymentStatus = paymentStatusFor({ ...b, amountPaid: paid });
    await this.bookings.update(b.id, { amountPaid: paid, paymentStatus });
    return { ...b, amountPaid: paid, paymentStatus };
  }

  /** Money came in: once the deposit (or full price) is in, a booking
   * that was waiting is confirmed. */
  private async settle(bookingId: string, amount: number) {
    const b = await this.recompute(bookingId);
    const trip = await this.itineraries.findOneOrFail({
      where: { id: b.itineraryId },
    });
    const autoConfirm =
      b.status === TripBookingStatus.PENDING && b.amountPaid >= amountToHold(b);
    if (autoConfirm) {
      await this.move(
        b,
        [TripBookingStatus.PENDING],
        TripBookingStatus.CONFIRMED,
        {
          confirmedAt: new Date(),
        },
      );
      await this.addMember(b, trip);
    }
    const owed = outstanding(b);
    await this.notify(b.userId, {
      type: autoConfirm ? "trip_booking.confirmed" : "trip_booking.updated",
      title: autoConfirm
        ? "Payment received — you're going! 🎉"
        : "Payment received",
      body: `The organiser of "${trip.title}" received ${amount} ${b.currency}.${owed > 0 ? ` ${owed} ${b.currency} is still to pay.` : " You're fully paid."}`,
      link: this.travellerLink(b),
    });
  }

  /** A confirmed traveller joins the trip: they see its plan and its
   * group chat, the way anyone invited does. */
  private async addMember(b: TripBooking, trip: Itinerary) {
    const existing = await this.collaborators.exists({
      where: { itineraryId: b.itineraryId, userId: b.userId },
    });
    if (!existing) {
      await this.collaborators.save(
        this.collaborators.create({
          itineraryId: b.itineraryId,
          userId: b.userId,
          role: CollaboratorRole.VIEWER,
          invitedByUserId: trip.userId,
        }),
      );
      await this.bookings.update(b.id, { addedAsMember: true });
    }
    await this.tripChat
      .postSystemMessage(
        b.itineraryId,
        `${b.contactName} is coming on the trip${b.seats > 1 ? ` with ${b.seats - 1} more` : ""}. Welcome! 👋`,
      )
      .catch(() => undefined);
  }

  private async removeMember(b: TripBooking) {
    if (!b.addedAsMember) return;
    await this.collaborators.delete({
      itineraryId: b.itineraryId,
      userId: b.userId,
    });
    await this.bookings.update(b.id, { addedAsMember: false });
  }

  /** Spots came free: tell the organiser if people are waiting, and the
   * first person waiting that a spot may be theirs. */
  private async spotsFreed(b: TripBooking) {
    const next = await this.bookings.findOne({
      where: {
        itineraryId: b.itineraryId,
        status: TripBookingStatus.WAITLISTED,
      },
      order: { createdAt: "ASC" },
    });
    if (!next) return;
    await this.notify(b.hostUserId, {
      type: "trip_booking.updated",
      title: "A spot opened up",
      body: `${spotsWord(b.seats)} came free on "${b.itinerary.title}". ${next.contactName} is first on the waitlist.`,
      link: this.hostLink(next),
    });
  }

  private rethrowDuplicateReference(e: unknown) {
    if ((e as { code?: string }).code === "23505")
      throw new ConflictException(
        "That transaction ID has already been used. Check it and try again.",
      );
  }

  private async freshCode(manager: EntityManager) {
    for (let i = 0; i < 5; i++) {
      const code = tripBookingCode();
      if (!(await manager.exists(TripBooking, { where: { code } })))
        return code;
    }
    throw new ConflictException("Please try again");
  }

  private travellerLink = (b: TripBooking) => `/account/trip-bookings/${b.id}`;

  private hostLink = (b: TripBooking) =>
    `/trips/${b.itineraryId}/host?booking=${b.id}`;

  private async notify(
    userId: string,
    input: {
      type: NotificationType;
      title: string;
      body: string;
      link: string;
    },
  ) {
    try {
      await this.notifications.create(userId, input);
    } catch {
      // A failed notification never undoes the booking change.
    }
  }

  private tripStatus(trip: Itinerary) {
    if (trip.cancelledAt) return "cancelled";
    const now = Date.now();
    if (trip.endDate && trip.endDate.getTime() < now) return "completed";
    if (trip.startDate && trip.startDate.getTime() <= now) return "ongoing";
    return "upcoming";
  }

  private tripSummary(trip: Itinerary) {
    return {
      id: trip.id,
      title: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      coverImage: trip.coverImage ?? trip.destination?.images?.[0] ?? null,
      destination: trip.destination
        ? {
            id: trip.destination.id,
            name: trip.destination.name,
            slug: trip.destination.slug,
            county: trip.destination.county?.name ?? null,
          }
        : null,
      status: this.tripStatus(trip),
    };
  }

  private async view(b: TripBooking, role: Role, trip: Itinerary) {
    const fresh = await this.bookings.findOneOrFail({
      where: { id: b.id },
      relations: { payments: true },
    });
    const hosting = await this.hosted.findOne({
      where: { itineraryId: fresh.itineraryId },
    });
    const qrDataUrl =
      role === "traveller" && fresh.status === TripBookingStatus.CONFIRMED
        ? await QRCode.toDataURL(ticketQrPayload(fresh.code), {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 480,
            color: { dark: "#0b3d2e", light: "#ffffff" },
          }).catch(() => null)
        : null;
    return {
      id: fresh.id,
      code: fresh.code,
      status: fresh.status,
      seats: fresh.seats,
      travellers: fresh.travellers,
      contactName: fresh.contactName,
      phone: fresh.phone,
      notes: fresh.notes,
      unitPrice: fresh.unitPrice,
      totalAmount: fresh.totalAmount,
      currency: fresh.currency,
      depositAmount: fresh.depositAmount,
      paymentPlan: fresh.paymentPlan,
      paymentMethod: fresh.paymentMethod,
      amountPaid: fresh.amountPaid,
      outstanding: outstanding(fresh),
      amountToHold: amountToHold(fresh),
      paymentStatus: fresh.paymentStatus,
      hostNote: fresh.hostNote,
      confirmedAt: fresh.confirmedAt,
      cancelledAt: fresh.cancelledAt,
      createdAt: fresh.createdAt,
      payments: [...fresh.payments]
        .sort((a, z) => a.createdAt.getTime() - z.createdAt.getTime())
        .map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          reference: p.reference,
          account: p.account,
          status: p.status,
          recordedByHost: p.recordedByHost,
          createdAt: p.createdAt,
          verifiedAt: p.verifiedAt,
        })),
      traveller: {
        id: fresh.userId,
        name: fresh.user?.name ?? fresh.contactName,
      },
      trip: this.tripSummary(trip),
      meetingPoint: hosting?.meetingPoint ?? null,
      departureTime: hosting?.departureTime ?? null,
      balanceDueDate: hosting?.balanceDueDate ?? null,
      contactPhone: hosting?.contactPhone ?? null,
      accountName: hosting?.accountName ?? null,
      paymentOptions: hosting ? this.paymentOptions(hosting) : [],
      viewerRole: role,
      qrDataUrl,
    };
  }
}
