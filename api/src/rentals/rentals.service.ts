import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, IsNull, Not, Repository } from "typeorm";
import { Booking } from "../bookings/entities/booking.entity";
import {
  BookingRentalUnit,
  BookingStatus,
} from "../bookings/entities/booking.enums";
import { CarListingBlockedDate } from "../car-listings/entities/car-listing-blocked-date.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { CarListingReviewStatus } from "../car-listings/entities/car-listing.enums";
import type { NotificationType } from "../notifications/entities/notification.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { SafetyService } from "../safety/safety.service";
import {
  CreateRentalDto,
  HandoverDto,
  RentalSettingsDto,
  ReturnDto,
} from "./dto/rentals.dto";
import { CarRental } from "./entities/car-rental.entity";
import { RentalMessage } from "./entities/rental-message.entity";
import { RentalSettings } from "./entities/rental-settings.entity";
import {
  HOLDING_RENTAL_STATUSES,
  RentalPaymentMethod,
  RentalPaymentStatus,
  RentalStatus,
  RentalUnit,
} from "./entities/rental.enums";
import {
  addDays,
  dueBack,
  heldWindow,
  money,
  overlaps,
  priceRental,
  rentalCode,
  rentalUnits,
  todayInLiberia,
  tripWindow,
  type TripLike,
  type Window,
} from "./rental-time";

const MAX_DAYS = 60;
type Role = "renter" | "owner";
type SettingsView = Omit<RentalSettings, "owner" | "updatedAt">;

const METHOD_LABELS: Record<RentalPaymentMethod, string> = {
  [RentalPaymentMethod.CASH_AT_PICKUP]: "Cash at pickup",
  [RentalPaymentMethod.MTN_MOMO]: "MTN MoMo",
  [RentalPaymentMethod.ORANGE_MONEY]: "Orange Money",
};

function defaults(ownerUserId: string): SettingsView {
  return {
    ownerUserId,
    cashAtPickupEnabled: true,
    mtnMomoNumber: null,
    orangeMoneyNumber: null,
    mobileMoneyAccountName: null,
  };
}

export function rentalPaymentOptions(s: SettingsView) {
  const options: Array<{
    method: RentalPaymentMethod;
    label: string;
    account: string | null;
  }> = [];
  if (s.cashAtPickupEnabled)
    options.push({
      method: RentalPaymentMethod.CASH_AT_PICKUP,
      label: METHOD_LABELS[RentalPaymentMethod.CASH_AT_PICKUP],
      account: null,
    });
  if (s.mtnMomoNumber)
    options.push({
      method: RentalPaymentMethod.MTN_MOMO,
      label: METHOD_LABELS[RentalPaymentMethod.MTN_MOMO],
      account: s.mtnMomoNumber,
    });
  if (s.orangeMoneyNumber)
    options.push({
      method: RentalPaymentMethod.ORANGE_MONEY,
      label: METHOD_LABELS[RentalPaymentMethod.ORANGE_MONEY],
      account: s.orangeMoneyNumber,
    });
  return options;
}

/** A legacy request-to-book booking's time on the car. */
function legacyTrip(b: Booking): TripLike {
  return {
    rentalUnit:
      b.rentalUnit === BookingRentalUnit.HOUR
        ? RentalUnit.HOUR
        : RentalUnit.DAY,
    pickupDate: b.requestedDate,
    returnDate: b.requestedEndDate ?? b.requestedDate,
    pickupTime: b.requestedStartTime,
    returnTime: b.requestedEndTime,
  };
}

const blockTrip = (b: CarListingBlockedDate): TripLike => ({
  rentalUnit: RentalUnit.DAY,
  pickupDate: b.startDate,
  returnDate: b.endDate,
});

@Injectable()
export class RentalsService {
  constructor(
    @InjectRepository(CarRental)
    private readonly rentals: Repository<CarRental>,
    @InjectRepository(RentalMessage)
    private readonly messages: Repository<RentalMessage>,
    @InjectRepository(RentalSettings)
    private readonly settings: Repository<RentalSettings>,
    @InjectRepository(CarListing)
    private readonly cars: Repository<CarListing>,
    private readonly notifications: NotificationsService,
    @Optional() private readonly safety?: SafetyService,
  ) {}

  // ── Lookups ─────────────────────────────────────────────────────────

  private async loadSettings(ownerUserId: string): Promise<SettingsView> {
    const found = await this.settings.findOne({ where: { ownerUserId } });
    if (!found) return defaults(ownerUserId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { owner: _o, updatedAt: _u, ...view } = found;
    return view;
  }

  private async bookableCar(carListingId: string) {
    const car = await this.cars.findOne({
      where: {
        id: carListingId,
        reviewStatus: CarListingReviewStatus.APPROVED,
        isActive: true,
      },
    });
    if (!car) throw new NotFoundException("This car isn't available to rent");
    return car;
  }

  /** Everything that already has the car in [from, to]. */
  private async busy(manager: EntityManager, carListingId: string) {
    const [rentals, bookings, blocks] = await Promise.all([
      manager.find(CarRental, {
        where: {
          carListingId,
          status: In([...HOLDING_RENTAL_STATUSES]),
        },
      }),
      manager.find(Booking, {
        where: {
          carListingId,
          status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
        },
      }),
      manager.find(CarListingBlockedDate, { where: { carListingId } }),
    ]);
    const now = Date.now();
    return {
      rentals,
      blocks,
      windows: [
        ...rentals.map((r) => ({
          kind: "rental" as const,
          window: heldWindow(r, r.status === RentalStatus.ON_TRIP, now),
        })),
        ...bookings.map((b) => ({
          kind: "rental" as const,
          window: tripWindow(legacyTrip(b)),
        })),
        ...blocks.map((b) => ({
          kind: "blocked" as const,
          window: tripWindow(blockTrip(b)),
        })),
      ],
    };
  }

  // ── Public ──────────────────────────────────────────────────────────

  /** How to pay for this car, and what to bring. */
  async terms(carListingId: string) {
    const car = await this.bookableCar(carListingId);
    const s = await this.loadSettings(car.ownerUserId);
    return {
      paymentOptions: rentalPaymentOptions(s),
      mobileMoneyAccountName: s.mobileMoneyAccountName,
      depositAmount: car.securityDeposit,
      minDriverAge: car.minDriverAge,
      instantBook: car.instantBookEnabled,
    };
  }

  // ── Renter ──────────────────────────────────────────────────────────

  async book(userId: string, dto: CreateRentalDto) {
    const car = await this.bookableCar(dto.carListingId);
    if (car.ownerUserId === userId)
      throw new BadRequestException("You can't rent your own car");
    const unit = dto.rentalUnit ?? RentalUnit.DAY;
    const today = todayInLiberia();
    if (dto.pickupDate < today)
      throw new BadRequestException("Pickup can't be in the past");
    if (dto.pickupDate > addDays(today, 365))
      throw new BadRequestException("You can book up to a year ahead");

    let returnDate = dto.returnDate ?? dto.pickupDate;
    if (unit === RentalUnit.HOUR) {
      if (car.pricePerHour == null)
        throw new BadRequestException("This car isn't rented by the hour");
      returnDate = dto.pickupDate;
    } else if (!dto.returnDate)
      throw new BadRequestException("Choose a return date");
    if (returnDate < dto.pickupDate)
      throw new BadRequestException("Return can't be before pickup");

    const trip: TripLike = {
      rentalUnit: unit,
      pickupDate: dto.pickupDate,
      returnDate,
      pickupTime: dto.pickupTime,
      returnTime: dto.returnTime,
    };
    const units = rentalUnits(trip);
    if (unit === RentalUnit.HOUR) {
      if (units <= 0)
        throw new BadRequestException("Return time must be after pickup time");
      if (units < (car.minRentalHours ?? 1))
        throw new BadRequestException(
          `This car is rented for at least ${car.minRentalHours} hours`,
        );
    } else {
      if (units < car.minRentalDays)
        throw new BadRequestException(
          `This car is rented for at least ${car.minRentalDays} days`,
        );
      if (units > MAX_DAYS)
        throw new BadRequestException(`Rent up to ${MAX_DAYS} days at a time`);
    }

    const price = priceRental(car, unit, units, {
      withDriver: Boolean(dto.withDriver),
      additionalDriver: Boolean(dto.additionalDriver),
      delivery: Boolean(dto.delivery),
    });
    if (price.delivery && !dto.deliveryAddress?.trim())
      throw new BadRequestException("Where should the car be delivered?");
    if (!price.withDriver && !dto.licenceNumber?.trim())
      throw new BadRequestException(
        "Add your driver's licence number. You'll show the licence at pickup.",
      );
    if (!price.withDriver && car.minDriverAge && !dto.ageConfirmed)
      throw new BadRequestException(
        `Drivers must be at least ${car.minDriverAge}`,
      );

    const settings = await this.loadSettings(car.ownerUserId);
    const option = rentalPaymentOptions(settings).find(
      (o) => o.method === dto.paymentMethod,
    );
    if (!option)
      throw new BadRequestException(
        `This owner doesn't take ${METHOD_LABELS[dto.paymentMethod]}`,
      );
    const mobile = dto.paymentMethod !== RentalPaymentMethod.CASH_AT_PICKUP;
    if (mobile && !dto.paymentReference?.trim())
      throw new BadRequestException(
        "Enter the transaction ID from your mobile money SMS",
      );
    const instant = car.instantBookEnabled && !mobile;

    let saved: CarRental;
    try {
      saved = await this.rentals.manager.transaction(async (manager) => {
        // The same lock the older request-to-book flow and blocked dates
        // take, so none of them can slip in between check and insert.
        await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          car.id,
        ]);
        const candidate = tripWindow(trip);
        const clash = (await this.busy(manager, car.id)).windows.find((w) =>
          overlaps(candidate, w.window),
        );
        if (clash)
          throw new ConflictException(
            clash.kind === "blocked"
              ? "The owner has this car off the road for part of those dates"
              : "This car is already booked for part of those dates",
          );
        return manager.save(
          CarRental,
          manager.create(CarRental, {
            code: await this.freshCode(manager),
            carListingId: car.id,
            ownerUserId: car.ownerUserId,
            renterUserId: userId,
            status: instant ? RentalStatus.CONFIRMED : RentalStatus.REQUESTED,
            confirmedAt: instant ? new Date() : null,
            rentalUnit: unit,
            pickupDate: dto.pickupDate,
            returnDate,
            pickupTime: dto.pickupTime,
            returnTime: dto.returnTime,
            units,
            withDriver: price.withDriver,
            additionalDriver: price.additionalDriver,
            delivery: price.delivery,
            deliveryAddress: price.delivery
              ? dto.deliveryAddress!.trim()
              : null,
            renterName: dto.renterName.trim(),
            renterPhone: dto.renterPhone.trim(),
            licenceNumber: dto.licenceNumber?.trim() || null,
            notes: dto.notes?.trim() || null,
            carTitle: car.title,
            carImage: car.images?.[0] ?? null,
            pickupLocation: car.pickupLocation,
            unitPrice: price.unitPrice,
            baseAmount: price.baseAmount,
            driverFee: price.driverFee,
            additionalDriverFee: price.additionalDriverFee,
            deliveryFee: price.deliveryFee,
            totalAmount: price.totalAmount,
            depositAmount: car.securityDeposit,
            mileageLimitPerDay: car.mileageLimitPerDay,
            excessMileageFee: car.excessMileageFee,
            currency: "USD",
            paymentMethod: dto.paymentMethod,
            paymentStatus: mobile
              ? RentalPaymentStatus.AWAITING_VERIFICATION
              : RentalPaymentStatus.PAY_AT_PICKUP,
            paymentReference: mobile ? dto.paymentReference!.trim() : null,
            paymentAccount: option.account,
          }),
        );
      });
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException(
          "That transaction ID has already been used. Check it and try again.",
        );
      throw e;
    }

    const when = `${saved.pickupDate} ${saved.pickupTime}`;
    void this.notify(car.ownerUserId, {
      type: instant ? "rental.confirmed" : "rental.requested",
      title: instant
        ? `${saved.renterName} booked your ${car.title}`
        : `Rental request from ${saved.renterName}`,
      body: mobile
        ? `${car.title}, pickup ${when}. Check ${option.label} for transaction ${saved.paymentReference}.`
        : `${car.title}, pickup ${when}. Paying cash at pickup.`,
      link: this.ownerLink(saved),
    });
    if (instant)
      void this.notify(userId, {
        type: "rental.confirmed",
        title: `Your ${car.title} is confirmed`,
        body: `Rental ${saved.code}. Pickup ${when}.`,
        link: this.renterLink(saved),
      });
    return this.view(await this.reload(saved.id), "renter");
  }

  private async freshCode(manager: EntityManager) {
    for (let i = 0; i < 5; i++) {
      const code = rentalCode();
      if (!(await manager.exists(CarRental, { where: { code } }))) return code;
    }
    throw new ConflictException("Please try again");
  }

  async mine(userId: string) {
    const list = await this.rentals.find({
      where: { renterUserId: userId },
      relations: { carListing: true },
      order: { pickupDate: "DESC" },
      take: 100,
    });
    return this.viewMany(list, "renter", userId);
  }

  async get(userId: string, id: string) {
    const { r, role } = await this.participant(userId, id);
    return this.view(r, role);
  }

  async cancel(userId: string, id: string) {
    const r = await this.asRenter(userId, id);
    const owedBack = [
      RentalPaymentStatus.PAID,
      RentalPaymentStatus.AWAITING_VERIFICATION,
    ].includes(r.paymentStatus);
    const updated = await this.move(
      r,
      [RentalStatus.REQUESTED, RentalStatus.CONFIRMED],
      {
        status: RentalStatus.CANCELLED,
        cancelledAt: new Date(),
        ...(owedBack ? { paymentStatus: RentalPaymentStatus.REFUND_DUE } : {}),
      },
      "This rental can't be cancelled any more",
    );
    void this.notify(r.ownerUserId, {
      type: "rental.cancelled",
      title: `${r.renterName} cancelled`,
      body: `${r.carTitle}, ${r.pickupDate}. The car is free again.${owedBack ? " A refund is due." : ""}`,
      link: this.ownerLink(r),
    });
    return this.view(updated, "renter");
  }

  async resendPayment(userId: string, id: string, reference: string) {
    const r = await this.asRenter(userId, id);
    if (r.paymentStatus !== RentalPaymentStatus.FAILED)
      throw new ConflictException("There's no payment to resend");
    let updated: CarRental;
    try {
      updated = await this.move(
        r,
        [RentalStatus.REQUESTED, RentalStatus.CONFIRMED],
        {
          paymentStatus: RentalPaymentStatus.AWAITING_VERIFICATION,
          paymentReference: reference.trim(),
        },
        "This rental is closed",
      );
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException(
          "That transaction ID has already been used. Check it and try again.",
        );
      throw e;
    }
    void this.notify(r.ownerUserId, {
      type: "rental.updated",
      title: `${r.renterName} sent a new transaction ID`,
      body: `Check ${METHOD_LABELS[r.paymentMethod]} for ${reference.trim()}.`,
      link: this.ownerLink(r),
    });
    return this.view(updated, "renter");
  }

  // ── Owner: settings ─────────────────────────────────────────────────

  getSettings(userId: string) {
    return this.loadSettings(userId);
  }

  async saveSettings(userId: string, dto: RentalSettingsDto) {
    const current =
      (await this.settings.findOne({ where: { ownerUserId: userId } })) ??
      this.settings.create(defaults(userId));
    if (dto.cashAtPickupEnabled !== undefined)
      current.cashAtPickupEnabled = dto.cashAtPickupEnabled;
    for (const key of [
      "mtnMomoNumber",
      "orangeMoneyNumber",
      "mobileMoneyAccountName",
    ] as const) {
      if (dto[key] !== undefined) current[key] = dto[key]?.trim() || null;
    }
    if (rentalPaymentOptions(current).length === 0)
      throw new BadRequestException(
        "Keep at least one way to pay: cash at pickup, MTN MoMo or Orange Money",
      );
    await this.settings.save(current);
    return this.loadSettings(userId);
  }

  // ── Owner: desk ─────────────────────────────────────────────────────

  async list(userId: string) {
    const list = await this.rentals.find({
      where: { ownerUserId: userId },
      relations: { carListing: true },
      order: { createdAt: "DESC" },
      take: 200,
    });
    return this.viewMany(list, "owner", userId);
  }

  /** Everything the owner needs today, in the order they need it. */
  async desk(userId: string) {
    const today = todayInLiberia();
    const [open, refunds, cars] = await Promise.all([
      this.rentals.find({
        where: {
          ownerUserId: userId,
          status: In([...HOLDING_RENTAL_STATUSES]),
        },
        relations: { carListing: true },
        order: { pickupDate: "ASC", pickupTime: "ASC" },
      }),
      this.rentals.find({
        where: {
          ownerUserId: userId,
          paymentStatus: RentalPaymentStatus.REFUND_DUE,
        },
        relations: { carListing: true },
        order: { updatedAt: "DESC" },
      }),
      this.cars.find({
        where: { ownerUserId: userId },
        order: { createdAt: "ASC" },
      }),
    ]);
    const all = await this.viewMany([...open, ...refunds], "owner", userId);
    const v = new Map(all.map((x) => [x.id, x]));
    const pick = (list: CarRental[]) => list.map((r) => v.get(r.id)!);
    const endOfToday = Date.parse(`${today}T23:59:59Z`);
    const onTrip = open.filter((r) => r.status === RentalStatus.ON_TRIP);
    const confirmed = open.filter((r) => r.status === RentalStatus.CONFIRMED);

    // Where every car is right now.
    const now = Date.now();
    const blocks = cars.length
      ? await this.rentals.manager.find(CarListingBlockedDate, {
          where: { carListingId: In(cars.map((c) => c.id)) },
        })
      : [];
    const todayWindow: Window = {
      start: Date.parse(`${today}T00:00:00Z`),
      end: endOfToday,
    };
    const fleet = cars.map((car) => {
      const out = onTrip.find((r) => r.carListingId === car.id);
      const booked = confirmed.find(
        (r) =>
          r.carListingId === car.id && overlaps(tripWindow(r), todayWindow),
      );
      const blocked = blocks.some(
        (b) =>
          b.carListingId === car.id &&
          overlaps(tripWindow(blockTrip(b)), todayWindow),
      );
      return {
        id: car.id,
        title: car.title,
        image: car.images?.[0] ?? null,
        active:
          car.isActive && car.reviewStatus === CarListingReviewStatus.APPROVED,
        state: out
          ? out && dueBack(out) < now
            ? ("overdue" as const)
            : ("out" as const)
          : booked
            ? ("going_out" as const)
            : blocked
              ? ("blocked" as const)
              : ("free" as const),
        rentalId: out?.id ?? booked?.id ?? null,
      };
    });

    return {
      date: today,
      fleet,
      requests: pick(open.filter((r) => r.status === RentalStatus.REQUESTED)),
      pickups: pick(confirmed.filter((r) => r.pickupDate <= today)),
      onTrip: pick(onTrip),
      dueBack: pick(onTrip.filter((r) => dueBack(r) <= endOfToday)),
      upcoming: pick(confirmed.filter((r) => r.pickupDate > today)).slice(
        0,
        20,
      ),
      refundsDue: pick(refunds),
    };
  }

  /** Each car, day by day: free, requested, booked, out or blocked. */
  async calendar(userId: string, from: string, days = 14) {
    const cars = await this.cars.find({
      where: { ownerUserId: userId },
      order: { createdAt: "ASC" },
    });
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
    const ids = cars.map((c) => c.id);
    const [rentals, bookings, blocks] = ids.length
      ? await Promise.all([
          this.rentals.find({
            where: {
              carListingId: In(ids),
              status: In([...HOLDING_RENTAL_STATUSES]),
            },
          }),
          this.rentals.manager.find(Booking, {
            where: {
              carListingId: In(ids),
              status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
            },
          }),
          this.rentals.manager.find(CarListingBlockedDate, {
            where: { carListingId: In(ids) },
          }),
        ])
      : [[], [], []];
    const now = Date.now();
    return {
      from,
      dates,
      cars: cars.map((car) => ({
        id: car.id,
        title: car.title,
        days: dates.map((date) => {
          const day: Window = {
            start: Date.parse(`${date}T00:00:00Z`),
            end: Date.parse(`${date}T23:59:59Z`),
          };
          const r = rentals.find(
            (x) =>
              x.carListingId === car.id &&
              overlaps(
                heldWindow(x, x.status === RentalStatus.ON_TRIP, now),
                day,
              ),
          );
          if (r)
            return {
              date,
              state:
                r.status === RentalStatus.ON_TRIP
                  ? ("out" as const)
                  : r.status === RentalStatus.REQUESTED
                    ? ("requested" as const)
                    : ("booked" as const),
              rentalId: r.id,
              label: r.renterName,
            };
          const b = bookings.find(
            (x) =>
              x.carListingId === car.id &&
              overlaps(tripWindow(legacyTrip(x)), day),
          );
          if (b)
            return {
              date,
              state: "booked" as const,
              rentalId: null,
              label: "Request",
            };
          const blk = blocks.find(
            (x) =>
              x.carListingId === car.id &&
              overlaps(tripWindow(blockTrip(x)), day),
          );
          if (blk)
            return {
              date,
              state: "blocked" as const,
              rentalId: null,
              label: blk.reason ?? "Blocked",
              blockId: blk.id,
            };
          return { date, state: "free" as const, rentalId: null, label: null };
        }),
      })),
    };
  }

  async respond(
    userId: string,
    id: string,
    action: "confirm" | "decline",
    message?: string,
  ) {
    const r = await this.asOwner(userId, id);
    const note = message?.trim() || null;
    if (action === "confirm") {
      if (
        r.paymentStatus === RentalPaymentStatus.AWAITING_VERIFICATION ||
        r.paymentStatus === RentalPaymentStatus.FAILED
      )
        throw new BadRequestException(
          "Check the mobile money payment first: mark it received to confirm",
        );
      const updated = await this.move(
        r,
        [RentalStatus.REQUESTED],
        {
          status: RentalStatus.CONFIRMED,
          confirmedAt: new Date(),
          ...(note ? { ownerNote: note } : {}),
        },
        "This request was already answered",
      );
      this.tellRenter(
        r,
        `Your ${r.carTitle} is confirmed`,
        `Rental ${r.code}. Pickup ${r.pickupDate} at ${r.pickupTime}.${note ? ` ${note}` : ""}`,
      );
      return this.view(updated, "owner");
    }
    const owedBack = [
      RentalPaymentStatus.PAID,
      RentalPaymentStatus.AWAITING_VERIFICATION,
    ].includes(r.paymentStatus);
    const updated = await this.move(
      r,
      [RentalStatus.REQUESTED],
      {
        status: RentalStatus.DECLINED,
        ownerNote: note,
        ...(owedBack ? { paymentStatus: RentalPaymentStatus.REFUND_DUE } : {}),
      },
      "This request was already answered",
    );
    this.tellRenter(
      r,
      `The ${r.carTitle} isn't available`,
      `${note ?? "The owner can't take this rental."}${owedBack ? " They'll refund your payment." : ""}`,
    );
    return this.view(updated, "owner");
  }

  /** Received confirms the rental; not found asks for the right ID. */
  async verifyPayment(userId: string, id: string, received: boolean) {
    const r = await this.asOwner(userId, id);
    if (r.paymentStatus !== RentalPaymentStatus.AWAITING_VERIFICATION)
      throw new ConflictException("There's no payment waiting to be checked");
    const wasRequest = r.status === RentalStatus.REQUESTED;
    const updated = await this.move(
      r,
      [RentalStatus.REQUESTED, RentalStatus.CONFIRMED],
      received
        ? {
            paymentStatus: RentalPaymentStatus.PAID,
            ...(wasRequest
              ? { status: RentalStatus.CONFIRMED, confirmedAt: new Date() }
              : {}),
          }
        : { paymentStatus: RentalPaymentStatus.FAILED },
      "This rental is closed",
    );
    this.tellRenter(
      r,
      received
        ? `Payment received: your ${r.carTitle} is confirmed`
        : "The owner couldn't find your payment",
      received
        ? `Rental ${r.code}. Pickup ${r.pickupDate} at ${r.pickupTime}.`
        : `Transaction ${r.paymentReference} wasn't found. Send the right ID to keep the car.`,
    );
    return this.view(updated, "owner");
  }

  /** The car leaves: licence seen, readings taken, deposit in hand. */
  async handover(userId: string, id: string, dto: HandoverDto) {
    const r = await this.asOwner(userId, id);
    if (r.pickupDate > todayInLiberia())
      throw new BadRequestException(`Pickup is on ${r.pickupDate}`);
    if (!r.withDriver && !dto.licenceChecked)
      throw new BadRequestException(
        "Check the renter's driving licence before handing over the keys",
      );
    const settles =
      dto.paymentCollected &&
      [
        RentalPaymentStatus.PAY_AT_PICKUP,
        RentalPaymentStatus.AWAITING_VERIFICATION,
        RentalPaymentStatus.FAILED,
      ].includes(r.paymentStatus);
    const updated = await this.move(
      r,
      [RentalStatus.CONFIRMED],
      {
        status: RentalStatus.ON_TRIP,
        pickedUpAt: new Date(),
        licenceChecked: dto.licenceChecked,
        pickupOdometer: dto.odometer ?? null,
        pickupFuel: dto.fuel ?? null,
        pickupNotes: dto.notes?.trim() || null,
        depositCollected:
          dto.depositCollected != null ? money(dto.depositCollected) : null,
        ...(settles ? { paymentStatus: RentalPaymentStatus.PAID } : {}),
      },
      "Only a confirmed rental can be handed over",
    );
    const back =
      r.rentalUnit === RentalUnit.HOUR
        ? `${r.returnTime} today`
        : `${r.returnDate} at ${r.returnTime}`;
    this.tellRenter(
      r,
      `Enjoy the ${r.carTitle}`,
      `You've picked it up. Please bring it back by ${back}.`,
    );
    return this.view(updated, "owner");
  }

  /** The car is back: readings, any extra charges, and the deposit. */
  async returnCar(userId: string, id: string, dto: ReturnDto) {
    const r = await this.asOwner(userId, id);
    if (
      dto.odometer != null &&
      r.pickupOdometer != null &&
      dto.odometer < r.pickupOdometer
    )
      throw new BadRequestException(
        `The odometer read ${r.pickupOdometer} at pickup`,
      );
    const extras = (dto.extraCharges ?? [])
      .map((c) => ({ label: c.label.trim(), amount: money(c.amount) }))
      .filter((c) => c.label && c.amount > 0);
    const extrasTotal = money(extras.reduce((n, c) => n + c.amount, 0));
    if (
      dto.depositReturned != null &&
      r.depositCollected != null &&
      dto.depositReturned > r.depositCollected
    )
      throw new BadRequestException(
        `Only ${r.depositCollected} was collected as the deposit`,
      );
    const updated = await this.move(
      r,
      [RentalStatus.ON_TRIP],
      {
        status: RentalStatus.RETURNED,
        returnedAt: new Date(),
        returnOdometer: dto.odometer ?? null,
        returnFuel: dto.fuel ?? null,
        returnNotes: dto.notes?.trim() || null,
        extraCharges: extras,
        extrasTotal,
        depositReturned:
          dto.depositReturned != null
            ? money(dto.depositReturned)
            : r.depositCollected,
        // Cash at pickup is settled by the time the keys come back.
        ...(r.paymentStatus === RentalPaymentStatus.PAY_AT_PICKUP
          ? { paymentStatus: RentalPaymentStatus.PAID }
          : {}),
      },
      "Only a car that's out can be returned",
    );
    this.tellRenter(
      r,
      `Thanks for renting the ${r.carTitle}`,
      extrasTotal
        ? `Returned. Extra charges: US$${extrasTotal.toFixed(2)}. See the details in your rental.`
        : "Returned with no extra charges. Leave a review if you have a minute.",
    );
    return this.view(updated, "owner");
  }

  async noShow(userId: string, id: string) {
    const r = await this.asOwner(userId, id);
    if (r.pickupDate > todayInLiberia())
      throw new BadRequestException("The renter isn't due yet");
    const updated = await this.move(
      r,
      [RentalStatus.CONFIRMED],
      { status: RentalStatus.NO_SHOW },
      "Only a confirmed rental can be marked as a no-show",
    );
    this.tellRenter(
      r,
      "Marked as not collected",
      `Rental ${r.code} for ${r.pickupDate} is closed. Message the owner if this is a mistake.`,
    );
    return this.view(updated, "owner");
  }

  async markRefunded(userId: string, id: string) {
    const r = await this.asOwner(userId, id);
    const res = await this.rentals.update(
      { id: r.id, paymentStatus: RentalPaymentStatus.REFUND_DUE },
      { paymentStatus: RentalPaymentStatus.REFUNDED },
    );
    if (!res.affected) throw new ConflictException("No refund is due");
    this.tellRenter(
      r,
      "You've been refunded",
      `US$${r.totalAmount.toFixed(2)} for rental ${r.code} was sent back.`,
    );
    return this.view(await this.reload(r.id), "owner");
  }

  // ── Messages ────────────────────────────────────────────────────────

  async listMessages(userId: string, id: string) {
    await this.participant(userId, id);
    await this.messages.update(
      { rentalId: id, senderUserId: Not(userId), readAt: IsNull() },
      { readAt: new Date() },
    );
    const list = await this.messages.find({
      where: { rentalId: id },
      order: { createdAt: "ASC" },
    });
    return list.map((m) => ({
      id: m.id,
      body: m.body,
      mine: m.senderUserId === userId,
      senderName: m.sender?.name ?? null,
      createdAt: m.createdAt,
      readAt: m.readAt,
    }));
  }

  async sendMessage(userId: string, id: string, body: string) {
    const { r, role } = await this.participant(userId, id);
    const other = role === "renter" ? r.ownerUserId : r.renterUserId;
    await this.safety?.assertCanContact(userId, [other]);
    const saved = await this.messages.save(
      this.messages.create({
        rentalId: id,
        senderUserId: userId,
        body: body.trim(),
      }),
    );
    void this.notify(other, {
      type: "rental_message.received",
      title:
        role === "renter"
          ? `Message from ${r.renterName}`
          : `Message about your ${r.carTitle}`,
      body: body.trim().slice(0, 200),
      link: role === "renter" ? this.ownerLink(r) : this.renterLink(r),
    });
    return {
      id: saved.id,
      body: saved.body,
      mine: true,
      senderName: null,
      createdAt: saved.createdAt,
      readAt: null,
    };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private reload(id: string) {
    return this.rentals.findOneOrFail({
      where: { id },
      relations: { carListing: true },
    });
  }

  private async participant(userId: string, id: string) {
    const r = await this.rentals.findOne({
      where: { id },
      relations: { carListing: true },
    });
    if (!r) throw new NotFoundException("Rental not found");
    if (r.renterUserId === userId) return { r, role: "renter" as Role };
    if (r.ownerUserId === userId) return { r, role: "owner" as Role };
    throw new NotFoundException("Rental not found");
  }

  private async asRenter(userId: string, id: string) {
    const { r, role } = await this.participant(userId, id);
    if (role !== "renter")
      throw new ForbiddenException("Only the renter can do this");
    return r;
  }

  private async asOwner(userId: string, id: string) {
    const { r, role } = await this.participant(userId, id);
    if (role !== "owner")
      throw new ForbiddenException("Only the car's owner can do this");
    return r;
  }

  /** Changes a rental only if it's still in one of `from`. */
  private async move(
    r: CarRental,
    from: RentalStatus[],
    patch: Partial<CarRental>,
    stale: string,
  ) {
    const res = await this.rentals.update(
      { id: r.id, status: In(from) },
      patch as never,
    );
    if (!res.affected) throw new ConflictException(stale);
    return this.reload(r.id);
  }

  private renterLink(r: CarRental) {
    return `/account/rentals/${r.id}`;
  }

  private ownerLink(r: CarRental) {
    return `/account/my-car-listings/rentals/${r.id}`;
  }

  private tellRenter(r: CarRental, title: string, body: string) {
    void this.notify(r.renterUserId, {
      type: "rental.updated",
      title,
      body,
      link: this.renterLink(r),
    });
  }

  private async notify(
    userId: string | null | undefined,
    input: {
      type: NotificationType;
      title: string;
      body: string;
      link: string;
    },
  ) {
    if (!userId) return;
    try {
      await this.notifications.create(userId, input);
    } catch {
      // A failed notification never undoes the rental change.
    }
  }

  private async unread(ids: string[], userId: string) {
    if (!ids.length) return new Map<string, number>();
    const rows: Array<{ id: string; n: string }> = await this.messages
      .createQueryBuilder("m")
      .select("m.rental_id", "id")
      .addSelect("COUNT(*)", "n")
      .where("m.rental_id IN (:...ids)", { ids })
      .andWhere("m.read_at IS NULL")
      .andWhere("m.sender_user_id != :userId", { userId })
      .groupBy("m.rental_id")
      .getRawMany();
    return new Map(rows.map((row) => [row.id, Number(row.n)]));
  }

  private async viewMany(list: CarRental[], role: Role, viewerId?: string) {
    const viewer =
      viewerId ??
      (role === "renter" ? list[0]?.renterUserId : list[0]?.ownerUserId);
    const unread = viewer
      ? await this.unread(
          list.map((r) => r.id),
          viewer,
        )
      : new Map<string, number>();
    return list.map((r) => this.serialize(r, role, unread.get(r.id) ?? 0));
  }

  private async view(r: CarRental, role: Role) {
    const viewer = role === "renter" ? r.renterUserId : r.ownerUserId;
    return (await this.viewMany([r], role, viewer))[0];
  }

  private serialize(r: CarRental, role: Role, unreadMessages: number) {
    const car = r.carListing;
    const due = dueBack(r);
    return {
      id: r.id,
      code: r.code,
      status: r.status,
      rentalUnit: r.rentalUnit,
      pickupDate: r.pickupDate,
      returnDate: r.returnDate,
      pickupTime: r.pickupTime,
      returnTime: r.returnTime,
      units: r.units,
      dueBackAt: new Date(due).toISOString(),
      overdue: r.status === RentalStatus.ON_TRIP && Date.now() > due,
      withDriver: r.withDriver,
      additionalDriver: r.additionalDriver,
      delivery: r.delivery,
      deliveryAddress: r.deliveryAddress,
      renterName: r.renterName,
      renterPhone: r.renterPhone,
      licenceNumber: r.licenceNumber,
      notes: r.notes,
      carListingId: r.carListingId,
      carTitle: r.carTitle,
      carImage: r.carImage,
      pickupLocation: r.pickupLocation,
      unitPrice: r.unitPrice,
      baseAmount: r.baseAmount,
      driverFee: r.driverFee,
      additionalDriverFee: r.additionalDriverFee,
      deliveryFee: r.deliveryFee,
      totalAmount: r.totalAmount,
      depositAmount: r.depositAmount,
      mileageLimitPerDay: r.mileageLimitPerDay,
      excessMileageFee: r.excessMileageFee,
      currency: r.currency,
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      paymentReference: r.paymentReference,
      paymentAccount: r.paymentAccount,
      ownerNote: r.ownerNote,
      pickedUpAt: r.pickedUpAt,
      pickupOdometer: r.pickupOdometer,
      pickupFuel: r.pickupFuel,
      pickupNotes: r.pickupNotes,
      licenceChecked: r.licenceChecked,
      depositCollected: r.depositCollected,
      returnedAt: r.returnedAt,
      returnOdometer: r.returnOdometer,
      returnFuel: r.returnFuel,
      returnNotes: r.returnNotes,
      extraCharges: r.extraCharges ?? [],
      extrasTotal: r.extrasTotal,
      depositReturned: r.depositReturned,
      confirmedAt: r.confirmedAt,
      cancelledAt: r.cancelledAt,
      createdAt: r.createdAt,
      owner: {
        phone: car?.contactPhone ?? null,
        whatsapp: car?.contactWhatsapp ?? null,
      },
      viewerRole: role,
      unreadMessages,
    };
  }
}
