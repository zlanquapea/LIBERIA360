import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  EntityManager,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from "typeorm";
import { Business } from "../businesses/entities/business.entity";
import { BusinessReviewStatus } from "../businesses/entities/business.enums";
import type { NotificationType } from "../notifications/entities/notification.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { SafetyService } from "../safety/safety.service";
import {
  addDays,
  nightlyUse,
  nightsBetween,
  reservationCode,
  roomsLeft,
  todayInLiberia,
} from "./availability";
import {
  CreateReservationDto,
  RoomBlockDto,
  RoomTypeDto,
  StaySettingsDto,
  WalkInDto,
} from "./dto/stays.dto";
import { ReservationMessage } from "./entities/reservation-message.entity";
import { RoomBlock } from "./entities/room-block.entity";
import { RoomReservation } from "./entities/room-reservation.entity";
import { RoomType } from "./entities/room-type.entity";
import { StaySettings } from "./entities/stay-settings.entity";
import {
  businessHasRooms,
  HOLDING_STATUSES,
  ReservationSource,
  ReservationStatus,
  StayPaymentMethod,
  StayPaymentStatus,
} from "./entities/stay.enums";

const MAX_NIGHTS = 60;
const BOOK_AHEAD_DAYS = 365;

type Role = "guest" | "property";
type SettingsView = Omit<StaySettings, "business" | "updatedAt">;

const METHOD_LABELS: Record<StayPaymentMethod, string> = {
  [StayPaymentMethod.PAY_AT_PROPERTY]: "Pay at the front desk",
  [StayPaymentMethod.MTN_MOMO]: "MTN MoMo",
  [StayPaymentMethod.ORANGE_MONEY]: "Orange Money",
};

const money = (n: number) => Math.round(n * 100) / 100;

function defaults(businessId: string): SettingsView {
  return {
    businessId,
    currency: "USD",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    instantConfirm: false,
    payAtPropertyEnabled: true,
    mtnMomoNumber: null,
    orangeMoneyNumber: null,
    mobileMoneyAccountName: null,
    cancellationPolicy: null,
    houseRules: null,
  };
}

/** The payment options a guest can choose from, with where to send money. */
export function paymentOptions(s: SettingsView) {
  const options: Array<{
    method: StayPaymentMethod;
    label: string;
    account: string | null;
  }> = [];
  if (s.payAtPropertyEnabled)
    options.push({
      method: StayPaymentMethod.PAY_AT_PROPERTY,
      label: METHOD_LABELS[StayPaymentMethod.PAY_AT_PROPERTY],
      account: null,
    });
  if (s.mtnMomoNumber)
    options.push({
      method: StayPaymentMethod.MTN_MOMO,
      label: METHOD_LABELS[StayPaymentMethod.MTN_MOMO],
      account: s.mtnMomoNumber,
    });
  if (s.orangeMoneyNumber)
    options.push({
      method: StayPaymentMethod.ORANGE_MONEY,
      label: METHOD_LABELS[StayPaymentMethod.ORANGE_MONEY],
      account: s.orangeMoneyNumber,
    });
  return options;
}

@Injectable()
export class StaysService {
  constructor(
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
    @InjectRepository(RoomType)
    private readonly roomTypes: Repository<RoomType>,
    @InjectRepository(RoomBlock)
    private readonly blocks: Repository<RoomBlock>,
    @InjectRepository(StaySettings)
    private readonly settings: Repository<StaySettings>,
    @InjectRepository(RoomReservation)
    private readonly reservations: Repository<RoomReservation>,
    @InjectRepository(ReservationMessage)
    private readonly messages: Repository<ReservationMessage>,
    private readonly notifications: NotificationsService,
    @Optional() private readonly safety?: SafetyService,
  ) {}

  // ── Lookups ─────────────────────────────────────────────────────────

  private async loadSettings(businessId: string): Promise<SettingsView> {
    const found = await this.settings.findOne({ where: { businessId } });
    if (!found) return defaults(businessId);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { business: _b, updatedAt: _u, ...view } = found;
    return view;
  }

  /** A property guests can book: approved, and a kind that has rooms. */
  private async bookableBusiness(businessId: string) {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    if (
      !business ||
      business.reviewStatus !== BusinessReviewStatus.APPROVED ||
      !businessHasRooms(business.type)
    )
      throw new NotFoundException("This property isn't taking bookings");
    return business;
  }

  async assertOwner(userId: string, businessId: string) {
    const business = await this.businesses.findOne({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException("Business not found");
    if (business.ownerUserId !== userId)
      throw new ForbiddenException("You don't manage this property");
    if (!businessHasRooms(business.type))
      throw new BadRequestException(
        "Rooms are for hotels, guesthouses, lodges and resorts",
      );
    return business;
  }

  private validateStay(checkIn: string, checkOut: string, allowPast = false) {
    const today = todayInLiberia();
    if (!allowPast && checkIn < today)
      throw new BadRequestException("Check-in can't be in the past");
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < 1)
      throw new BadRequestException("Check-out must be after check-in");
    if (nights > MAX_NIGHTS)
      throw new BadRequestException(
        `Book up to ${MAX_NIGHTS} nights at a time`,
      );
    if (checkIn > addDays(today, BOOK_AHEAD_DAYS))
      throw new BadRequestException("You can book up to a year ahead");
    return nights;
  }

  /** Stays and blocks that touch any night in [from, to). */
  private async held(
    manager: EntityManager,
    roomTypeIds: string[],
    from: string,
    to: string,
  ) {
    if (!roomTypeIds.length) return { stays: [], blocks: [] };
    const [stays, blocks] = await Promise.all([
      manager.find(RoomReservation, {
        where: {
          roomTypeId: In(roomTypeIds),
          status: In([...HOLDING_STATUSES]),
          checkIn: LessThan(to),
          checkOut: MoreThan(from),
        },
      }),
      manager.find(RoomBlock, {
        where: {
          roomTypeId: In(roomTypeIds),
          startDate: LessThan(to),
          endDate: MoreThanOrEqual(from),
        },
      }),
    ]);
    return { stays, blocks };
  }

  private async lock(manager: EntityManager, roomTypeId: string) {
    await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `room-type:${roomTypeId}`,
    ]);
  }

  // ── Public ──────────────────────────────────────────────────────────

  async getStay(businessId: string) {
    await this.bookableBusiness(businessId);
    const settings = await this.loadSettings(businessId);
    const rooms = await this.roomTypes.find({
      where: { businessId, isActive: true },
      order: { sortOrder: "ASC", pricePerNight: "ASC" },
    });
    return {
      currency: settings.currency,
      checkInTime: settings.checkInTime,
      checkOutTime: settings.checkOutTime,
      instantConfirm: settings.instantConfirm,
      cancellationPolicy: settings.cancellationPolicy,
      houseRules: settings.houseRules,
      mobileMoneyAccountName: settings.mobileMoneyAccountName,
      paymentOptions: paymentOptions(settings),
      roomTypes: rooms.map((r) => this.publicRoom(r)),
    };
  }

  private publicRoom(r: RoomType) {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      images: r.images,
      maxGuests: r.maxGuests,
      bedSummary: r.bedSummary,
      pricePerNight: r.pricePerNight,
      amenities: r.amenities,
    };
  }

  /** Rooms left of each type for every night of the stay. */
  async availability(businessId: string, checkIn: string, checkOut: string) {
    await this.bookableBusiness(businessId);
    const nights = this.validateStay(checkIn, checkOut);
    const rooms = await this.roomTypes.find({
      where: { businessId, isActive: true },
    });
    const { stays, blocks } = await this.held(
      this.reservations.manager,
      rooms.map((r) => r.id),
      checkIn,
      checkOut,
    );
    return {
      checkIn,
      checkOut,
      nights,
      rooms: rooms.map((r) => ({
        roomTypeId: r.id,
        roomsLeft: roomsLeft(
          r.totalRooms,
          checkIn,
          checkOut,
          stays.filter((s) => s.roomTypeId === r.id),
          blocks.filter((b) => b.roomTypeId === r.id),
        ),
        total: money(r.pricePerNight * nights),
      })),
    };
  }

  // ── Guest ───────────────────────────────────────────────────────────

  async reserve(userId: string, dto: CreateReservationDto) {
    const room = await this.roomTypes.findOne({
      where: { id: dto.roomTypeId, isActive: true },
    });
    if (!room) throw new NotFoundException("That room isn't available");
    const business = await this.bookableBusiness(room.businessId);
    if (business.ownerUserId === userId)
      throw new BadRequestException(
        "You can't book a room at your own property",
      );
    const nights = this.validateStay(dto.checkIn, dto.checkOut);
    const children = dto.children ?? 0;
    if (dto.adults + children > room.maxGuests * dto.rooms)
      throw new BadRequestException(
        `${room.name} sleeps up to ${room.maxGuests} per room. Add another room for ${dto.adults + children} guests.`,
      );

    const settings = await this.loadSettings(business.id);
    const option = paymentOptions(settings).find(
      (o) => o.method === dto.paymentMethod,
    );
    if (!option)
      throw new BadRequestException(
        `${business.name} doesn't take ${METHOD_LABELS[dto.paymentMethod]}`,
      );
    const mobileMoney = dto.paymentMethod !== StayPaymentMethod.PAY_AT_PROPERTY;
    if (mobileMoney && !dto.paymentReference?.trim())
      throw new BadRequestException(
        "Enter the transaction ID from your mobile money SMS",
      );
    const instant = settings.instantConfirm && !mobileMoney;

    let saved: RoomReservation;
    try {
      saved = await this.reservations.manager.transaction(async (manager) => {
        await this.lock(manager, room.id);
        const { stays, blocks } = await this.held(
          manager,
          [room.id],
          dto.checkIn,
          dto.checkOut,
        );
        const left = roomsLeft(
          room.totalRooms,
          dto.checkIn,
          dto.checkOut,
          stays,
          blocks,
        );
        if (left < dto.rooms)
          throw new ConflictException(
            left === 0
              ? `${room.name} is fully booked for those nights`
              : `Only ${left} ${room.name} ${left === 1 ? "room is" : "rooms are"} left for those nights`,
          );
        return manager.save(
          RoomReservation,
          manager.create(RoomReservation, {
            code: await this.freshCode(manager),
            businessId: business.id,
            guestUserId: userId,
            roomTypeId: room.id,
            source: ReservationSource.ONLINE,
            checkIn: dto.checkIn,
            checkOut: dto.checkOut,
            nights,
            rooms: dto.rooms,
            adults: dto.adults,
            children,
            guestName: dto.guestName.trim(),
            guestPhone: dto.guestPhone.trim(),
            arrivalTime: dto.arrivalTime?.trim() || null,
            specialRequests: dto.specialRequests?.trim() || null,
            roomName: room.name,
            pricePerNight: room.pricePerNight,
            totalAmount: money(room.pricePerNight * nights * dto.rooms),
            currency: settings.currency,
            status: instant
              ? ReservationStatus.CONFIRMED
              : ReservationStatus.REQUESTED,
            confirmedAt: instant ? new Date() : null,
            paymentMethod: dto.paymentMethod,
            paymentStatus: mobileMoney
              ? StayPaymentStatus.AWAITING_VERIFICATION
              : StayPaymentStatus.PAY_AT_PROPERTY,
            paymentReference: mobileMoney ? dto.paymentReference!.trim() : null,
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

    const when = `${saved.nights} ${saved.nights === 1 ? "night" : "nights"} from ${saved.checkIn}`;
    void this.notify(business.ownerUserId, {
      type: instant ? "stay.confirmed" : "stay.requested",
      title: instant
        ? `New booking: ${saved.guestName}`
        : `Booking request from ${saved.guestName}`,
      body: mobileMoney
        ? `${saved.rooms} × ${saved.roomName}, ${when}. Check ${option.label} for transaction ${saved.paymentReference}.`
        : `${saved.rooms} × ${saved.roomName}, ${when}. Paying at the front desk.`,
      link: this.propertyLink(saved),
    });
    if (instant)
      void this.notify(userId, {
        type: "stay.confirmed",
        title: `Your room at ${business.name} is confirmed`,
        body: `Booking ${saved.code}. Check-in from ${settings.checkInTime} on ${saved.checkIn}.`,
        link: this.guestLink(saved),
      });
    return this.view(await this.reload(saved.id), "guest");
  }

  private async freshCode(manager: EntityManager) {
    for (let i = 0; i < 5; i++) {
      const code = reservationCode();
      if (!(await manager.exists(RoomReservation, { where: { code } })))
        return code;
    }
    throw new ConflictException("Please try again");
  }

  async mine(userId: string) {
    const list = await this.reservations.find({
      where: { guestUserId: userId },
      relations: { roomType: true },
      order: { checkIn: "DESC" },
      take: 100,
    });
    return this.viewMany(list, "guest");
  }

  async get(userId: string, id: string) {
    const { r, role } = await this.participant(userId, id);
    return this.view(r, role);
  }

  async cancel(userId: string, id: string) {
    const r = await this.asGuest(userId, id);
    const owedBack = [
      StayPaymentStatus.PAID,
      StayPaymentStatus.AWAITING_VERIFICATION,
    ].includes(r.paymentStatus);
    const updated = await this.move(
      r,
      [ReservationStatus.REQUESTED, ReservationStatus.CONFIRMED],
      {
        status: ReservationStatus.CANCELLED,
        cancelledAt: new Date(),
        ...(owedBack ? { paymentStatus: StayPaymentStatus.REFUND_DUE } : {}),
      },
      "This booking can't be cancelled any more",
    );
    void this.notify(r.business.ownerUserId, {
      type: "stay.cancelled",
      title: `${r.guestName} cancelled`,
      body: `${r.rooms} × ${r.roomName}, ${r.checkIn} to ${r.checkOut}. The rooms are free again.${owedBack ? " A refund is due." : ""}`,
      link: this.propertyLink(r),
    });
    return this.view(updated, "guest");
  }

  async resendPayment(userId: string, id: string, reference: string) {
    const r = await this.asGuest(userId, id);
    if (r.paymentStatus !== StayPaymentStatus.FAILED)
      throw new ConflictException("There's no payment to resend");
    let updated: RoomReservation;
    try {
      updated = await this.move(
        r,
        [ReservationStatus.REQUESTED, ReservationStatus.CONFIRMED],
        {
          paymentStatus: StayPaymentStatus.AWAITING_VERIFICATION,
          paymentReference: reference.trim(),
        },
        "This booking is closed",
      );
    } catch (e) {
      if ((e as { code?: string }).code === "23505")
        throw new ConflictException(
          "That transaction ID has already been used. Check it and try again.",
        );
      throw e;
    }
    void this.notify(r.business.ownerUserId, {
      type: "stay.updated",
      title: `${r.guestName} sent a new transaction ID`,
      body: `Check ${METHOD_LABELS[r.paymentMethod]} for ${reference.trim()}.`,
      link: this.propertyLink(r),
    });
    return this.view(updated, "guest");
  }

  // ── Property: setup ─────────────────────────────────────────────────

  async manage(userId: string, businessId: string) {
    await this.assertOwner(userId, businessId);
    const [settings, rooms] = await Promise.all([
      this.loadSettings(businessId),
      this.roomTypes.find({
        where: { businessId },
        order: { sortOrder: "ASC", createdAt: "ASC" },
      }),
    ]);
    return { settings, roomTypes: rooms };
  }

  async saveSettings(userId: string, businessId: string, dto: StaySettingsDto) {
    await this.assertOwner(userId, businessId);
    const current =
      (await this.settings.findOne({ where: { businessId } })) ??
      this.settings.create(defaults(businessId));
    const text = (v: string | null | undefined) =>
      v === undefined ? undefined : v?.trim() || null;
    const next = Object.assign(current, {
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.checkInTime !== undefined
        ? { checkInTime: dto.checkInTime }
        : {}),
      ...(dto.checkOutTime !== undefined
        ? { checkOutTime: dto.checkOutTime }
        : {}),
      ...(dto.instantConfirm !== undefined
        ? { instantConfirm: dto.instantConfirm }
        : {}),
      ...(dto.payAtPropertyEnabled !== undefined
        ? { payAtPropertyEnabled: dto.payAtPropertyEnabled }
        : {}),
    });
    for (const key of [
      "mtnMomoNumber",
      "orangeMoneyNumber",
      "mobileMoneyAccountName",
      "cancellationPolicy",
      "houseRules",
    ] as const) {
      const value = text(dto[key]);
      if (value !== undefined) next[key] = value;
    }
    if (paymentOptions(next).length === 0)
      throw new BadRequestException(
        "Keep at least one way to pay: at the front desk, MTN MoMo or Orange Money",
      );
    await this.settings.save(next);
    return this.loadSettings(businessId);
  }

  async createRoomType(userId: string, businessId: string, dto: RoomTypeDto) {
    await this.assertOwner(userId, businessId);
    const count = await this.roomTypes.count({ where: { businessId } });
    if (count >= 50)
      throw new BadRequestException("A property can list up to 50 room types");
    return this.roomTypes.save(
      this.roomTypes.create({
        businessId,
        ...this.roomFields(dto),
        sortOrder: dto.sortOrder ?? count,
      }),
    );
  }

  async updateRoomType(
    userId: string,
    businessId: string,
    roomTypeId: string,
    dto: RoomTypeDto,
  ) {
    await this.assertOwner(userId, businessId);
    const room = await this.roomTypes.findOne({
      where: { id: roomTypeId, businessId },
    });
    if (!room) throw new NotFoundException("Room type not found");
    Object.assign(room, this.roomFields(dto));
    if (dto.sortOrder !== undefined) room.sortOrder = dto.sortOrder;
    return this.roomTypes.save(room);
  }

  private roomFields(dto: RoomTypeDto) {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      images: dto.images ?? [],
      maxGuests: dto.maxGuests,
      bedSummary: dto.bedSummary?.trim() || null,
      pricePerNight: money(dto.pricePerNight),
      totalRooms: dto.totalRooms,
      amenities: (dto.amenities ?? []).map((a) => a.trim()).filter(Boolean),
      isActive: dto.isActive ?? true,
    };
  }

  /** Deletes a room type nobody has booked; otherwise just hides it, so
   * past bookings keep their history. */
  async removeRoomType(userId: string, businessId: string, roomTypeId: string) {
    await this.assertOwner(userId, businessId);
    const room = await this.roomTypes.findOne({
      where: { id: roomTypeId, businessId },
    });
    if (!room) throw new NotFoundException("Room type not found");
    const booked = await this.reservations.exists({ where: { roomTypeId } });
    if (booked) {
      await this.roomTypes.update({ id: roomTypeId }, { isActive: false });
      return { deleted: false, hidden: true };
    }
    await this.roomTypes.delete({ id: roomTypeId });
    return { deleted: true, hidden: false };
  }

  // ── Property: availability ─────────────────────────────────────────

  /** Rooms booked, blocked and left for each room type and night. */
  async calendar(userId: string, businessId: string, from: string, days = 14) {
    await this.assertOwner(userId, businessId);
    const to = addDays(from, days);
    const rooms = await this.roomTypes.find({
      where: { businessId, isActive: true },
      order: { sortOrder: "ASC", createdAt: "ASC" },
    });
    const { stays, blocks } = await this.held(
      this.reservations.manager,
      rooms.map((r) => r.id),
      from,
      to,
    );
    const nights = Array.from({ length: days }, (_, i) => addDays(from, i));
    return {
      from,
      nights,
      roomTypes: rooms.map((r) => {
        const mine = stays.filter((s) => s.roomTypeId === r.id);
        const myBlocks = blocks.filter((b) => b.roomTypeId === r.id);
        const use = nightlyUse(from, to, mine, myBlocks);
        return {
          id: r.id,
          name: r.name,
          totalRooms: r.totalRooms,
          nights: nights.map((night, i) => ({
            date: night,
            booked: use.booked[i],
            blocked: use.blocked[i],
            left: Math.max(0, r.totalRooms - use.booked[i] - use.blocked[i]),
          })),
          blocks: myBlocks.map((b) => ({
            id: b.id,
            startDate: b.startDate,
            endDate: b.endDate,
            rooms: b.rooms,
            reason: b.reason,
          })),
        };
      }),
    };
  }

  async addBlock(userId: string, businessId: string, dto: RoomBlockDto) {
    await this.assertOwner(userId, businessId);
    if (dto.endDate < dto.startDate)
      throw new BadRequestException("The last night can't be before the first");
    if (nightsBetween(dto.startDate, dto.endDate) > 365)
      throw new BadRequestException("Block up to a year at a time");
    const room = await this.roomTypes.findOne({
      where: { id: dto.roomTypeId, businessId },
    });
    if (!room) throw new NotFoundException("Room type not found");
    return this.reservations.manager.transaction(async (manager) => {
      await this.lock(manager, room.id);
      const end = addDays(dto.endDate, 1);
      const { stays, blocks } = await this.held(
        manager,
        [room.id],
        dto.startDate,
        end,
      );
      const left = roomsLeft(
        room.totalRooms,
        dto.startDate,
        end,
        stays,
        blocks,
      );
      if (left < dto.rooms)
        throw new ConflictException(
          left === 0
            ? "Every room of this type is already booked or blocked on some of those nights"
            : `Only ${left} can be blocked: the rest are booked on some of those nights`,
        );
      return manager.save(
        RoomBlock,
        manager.create(RoomBlock, {
          roomTypeId: room.id,
          startDate: dto.startDate,
          endDate: dto.endDate,
          rooms: dto.rooms,
          reason: dto.reason?.trim() || null,
        }),
      );
    });
  }

  async removeBlock(userId: string, businessId: string, blockId: string) {
    await this.assertOwner(userId, businessId);
    const block = await this.blocks.findOne({
      where: { id: blockId },
      relations: { roomType: true },
    });
    if (!block || block.roomType.businessId !== businessId)
      throw new NotFoundException("Block not found");
    await this.blocks.delete({ id: blockId });
    return { removed: true };
  }

  // ── Property: front desk ───────────────────────────────────────────

  async reservationsFor(userId: string, businessId: string) {
    await this.assertOwner(userId, businessId);
    const list = await this.reservations.find({
      where: { businessId },
      relations: { roomType: true },
      order: { createdAt: "DESC" },
      take: 200,
    });
    return this.viewMany(list, "property");
  }

  /** Everything the front desk needs today, in the order they need it. */
  async frontDesk(userId: string, businessId: string, date?: string) {
    await this.assertOwner(userId, businessId);
    const day = date ?? todayInLiberia();
    const [requests, arrivals, inHouse, refunds, rooms] = await Promise.all([
      this.reservations.find({
        where: { businessId, status: ReservationStatus.REQUESTED },
        order: { checkIn: "ASC" },
      }),
      this.reservations.find({
        where: {
          businessId,
          status: ReservationStatus.CONFIRMED,
          checkIn: LessThanOrEqual(day),
        },
        order: { checkIn: "ASC" },
      }),
      this.reservations.find({
        where: { businessId, status: ReservationStatus.CHECKED_IN },
        order: { checkOut: "ASC" },
      }),
      this.reservations.find({
        where: { businessId, paymentStatus: StayPaymentStatus.REFUND_DUE },
        order: { updatedAt: "DESC" },
      }),
      this.roomTypes.find({
        where: { businessId, isActive: true },
        order: { sortOrder: "ASC", createdAt: "ASC" },
      }),
    ]);
    const upcoming = await this.reservations.find({
      where: {
        businessId,
        status: ReservationStatus.CONFIRMED,
        checkIn: MoreThan(day),
      },
      order: { checkIn: "ASC" },
      take: 20,
    });
    const tonight = addDays(day, 1);
    const { stays, blocks } = await this.held(
      this.reservations.manager,
      rooms.map((r) => r.id),
      day,
      tonight,
    );
    const occupancy = rooms.map((r) => {
      const use = nightlyUse(
        day,
        tonight,
        stays.filter((s) => s.roomTypeId === r.id),
        blocks.filter((b) => b.roomTypeId === r.id),
      );
      return {
        id: r.id,
        name: r.name,
        totalRooms: r.totalRooms,
        booked: use.booked[0] ?? 0,
        blocked: use.blocked[0] ?? 0,
        left: Math.max(
          0,
          r.totalRooms - (use.booked[0] ?? 0) - (use.blocked[0] ?? 0),
        ),
      };
    });
    const [vRequests, vArrivals, vInHouse, vRefunds, vUpcoming] =
      await Promise.all(
        [requests, arrivals, inHouse, refunds, upcoming].map((l) =>
          this.viewMany(l, "property"),
        ),
      );
    return {
      date: day,
      occupancy,
      requests: vRequests,
      arrivals: vArrivals,
      inHouse: vInHouse,
      departures: vInHouse.filter((r) => r.checkOut <= day),
      upcoming: vUpcoming,
      refundsDue: vRefunds,
    };
  }

  async respond(
    userId: string,
    id: string,
    action: "confirm" | "decline",
    message?: string,
  ) {
    const r = await this.asProperty(userId, id);
    const note = message?.trim() || null;
    if (action === "confirm") {
      if (
        r.paymentStatus === StayPaymentStatus.AWAITING_VERIFICATION ||
        r.paymentStatus === StayPaymentStatus.FAILED
      )
        throw new BadRequestException(
          "Check the mobile money payment first: mark it received to confirm",
        );
      const updated = await this.move(
        r,
        [ReservationStatus.REQUESTED],
        {
          status: ReservationStatus.CONFIRMED,
          confirmedAt: new Date(),
          ...(note ? { propertyNote: note } : {}),
        },
        "This request was already answered",
      );
      this.tellGuest(
        r,
        `Your room at ${r.business.name} is confirmed`,
        `Booking ${r.code}. ${r.rooms} × ${r.roomName}, check-in ${r.checkIn}.${note ? ` ${note}` : ""}`,
      );
      return this.view(updated, "property");
    }
    const owedBack = [
      StayPaymentStatus.PAID,
      StayPaymentStatus.AWAITING_VERIFICATION,
    ].includes(r.paymentStatus);
    const updated = await this.move(
      r,
      [ReservationStatus.REQUESTED],
      {
        status: ReservationStatus.DECLINED,
        propertyNote: note,
        ...(owedBack ? { paymentStatus: StayPaymentStatus.REFUND_DUE } : {}),
      },
      "This request was already answered",
    );
    this.tellGuest(
      r,
      `${r.business.name} can't take your booking`,
      `${note ?? "They have no room for those dates."}${owedBack ? " They'll refund your payment." : ""}`,
    );
    return this.view(updated, "property");
  }

  /** The front desk checks its mobile money: received confirms the
   * booking, not found asks the guest for the right transaction ID. */
  async verifyPayment(userId: string, id: string, received: boolean) {
    const r = await this.asProperty(userId, id);
    if (r.paymentStatus !== StayPaymentStatus.AWAITING_VERIFICATION)
      throw new ConflictException("There's no payment waiting to be checked");
    const wasRequest = r.status === ReservationStatus.REQUESTED;
    const updated = await this.move(
      r,
      [ReservationStatus.REQUESTED, ReservationStatus.CONFIRMED],
      received
        ? {
            paymentStatus: StayPaymentStatus.PAID,
            ...(wasRequest
              ? { status: ReservationStatus.CONFIRMED, confirmedAt: new Date() }
              : {}),
          }
        : { paymentStatus: StayPaymentStatus.FAILED },
      "This booking is closed",
    );
    this.tellGuest(
      r,
      received
        ? `Payment received: your room at ${r.business.name} is confirmed`
        : `${r.business.name} couldn't find your payment`,
      received
        ? `Booking ${r.code}. Check-in ${r.checkIn}.`
        : `Transaction ${r.paymentReference} wasn't found. Send the right transaction ID to keep your booking.`,
    );
    return this.view(updated, "property");
  }

  async checkIn(userId: string, id: string, roomNumbers?: string) {
    const r = await this.asProperty(userId, id);
    if (r.checkIn > todayInLiberia())
      throw new BadRequestException(`Check-in opens on ${r.checkIn}`);
    const updated = await this.move(
      r,
      [ReservationStatus.CONFIRMED],
      {
        status: ReservationStatus.CHECKED_IN,
        checkedInAt: new Date(),
        roomNumbers: roomNumbers?.trim() || r.roomNumbers,
      },
      "Only a confirmed booking can be checked in",
    );
    this.tellGuest(
      r,
      `Welcome to ${r.business.name}`,
      updated.roomNumbers
        ? `You're checked in. Room ${updated.roomNumbers}.`
        : "You're checked in. Enjoy your stay.",
    );
    return this.view(updated, "property");
  }

  async checkOut(userId: string, id: string) {
    const r = await this.asProperty(userId, id);
    const updated = await this.move(
      r,
      [ReservationStatus.CHECKED_IN],
      {
        status: ReservationStatus.CHECKED_OUT,
        checkedOutAt: new Date(),
        // Paying at the desk is settled by the time the guest leaves.
        ...(r.paymentStatus === StayPaymentStatus.PAY_AT_PROPERTY
          ? { paymentStatus: StayPaymentStatus.PAID }
          : {}),
      },
      "Only a guest who is checked in can check out",
    );
    this.tellGuest(
      r,
      `Thanks for staying at ${r.business.name}`,
      "You're checked out. Safe travels, and leave a review if you have a minute.",
    );
    return this.view(updated, "property");
  }

  async noShow(userId: string, id: string) {
    const r = await this.asProperty(userId, id);
    if (r.checkIn > todayInLiberia())
      throw new BadRequestException("The guest isn't due yet");
    const updated = await this.move(
      r,
      [ReservationStatus.CONFIRMED],
      { status: ReservationStatus.NO_SHOW },
      "Only a confirmed booking can be marked as a no-show",
    );
    this.tellGuest(
      r,
      `${r.business.name} marked you as not arrived`,
      `Booking ${r.code} for ${r.checkIn} is closed. Message them if this is a mistake.`,
    );
    return this.view(updated, "property");
  }

  async markRefunded(userId: string, id: string) {
    const r = await this.asProperty(userId, id);
    const res = await this.reservations.update(
      { id: r.id, paymentStatus: StayPaymentStatus.REFUND_DUE },
      { paymentStatus: StayPaymentStatus.REFUNDED },
    );
    if (!res.affected) throw new ConflictException("No refund is due");
    this.tellGuest(
      r,
      `${r.business.name} refunded you`,
      `Your ${r.currency} ${r.totalAmount} for booking ${r.code} was sent back.`,
    );
    return this.view(await this.reload(r.id), "property");
  }

  /** A guest who turned up without booking: checked straight in, so the
   * rooms left stay right for everyone booking online. */
  async walkIn(userId: string, businessId: string, dto: WalkInDto) {
    await this.assertOwner(userId, businessId);
    const room = await this.roomTypes.findOne({
      where: { id: dto.roomTypeId, businessId, isActive: true },
    });
    if (!room) throw new NotFoundException("Room type not found");
    const checkIn = todayInLiberia();
    const nights = this.validateStay(checkIn, dto.checkOut);
    const settings = await this.loadSettings(businessId);
    const saved = await this.reservations.manager.transaction(
      async (manager) => {
        await this.lock(manager, room.id);
        const { stays, blocks } = await this.held(
          manager,
          [room.id],
          checkIn,
          dto.checkOut,
        );
        const left = roomsLeft(
          room.totalRooms,
          checkIn,
          dto.checkOut,
          stays,
          blocks,
        );
        if (left < dto.rooms)
          throw new ConflictException(
            left === 0
              ? `No ${room.name} rooms are free for those nights`
              : `Only ${left} ${room.name} free for those nights`,
          );
        const now = new Date();
        return manager.save(
          RoomReservation,
          manager.create(RoomReservation, {
            code: await this.freshCode(manager),
            businessId,
            guestUserId: null,
            roomTypeId: room.id,
            source: ReservationSource.WALK_IN,
            checkIn,
            checkOut: dto.checkOut,
            nights,
            rooms: dto.rooms,
            adults: dto.adults,
            children: 0,
            guestName: dto.guestName.trim(),
            guestPhone: dto.guestPhone?.trim() || null,
            roomName: room.name,
            pricePerNight: room.pricePerNight,
            totalAmount: money(room.pricePerNight * nights * dto.rooms),
            currency: settings.currency,
            status: ReservationStatus.CHECKED_IN,
            confirmedAt: now,
            checkedInAt: now,
            roomNumbers: dto.roomNumbers?.trim() || null,
            paymentMethod: StayPaymentMethod.PAY_AT_PROPERTY,
            paymentStatus: dto.paid
              ? StayPaymentStatus.PAID
              : StayPaymentStatus.PAY_AT_PROPERTY,
          }),
        );
      },
    );
    return this.view(await this.reload(saved.id), "property");
  }

  // ── Messages ────────────────────────────────────────────────────────

  async listMessages(userId: string, id: string) {
    await this.participant(userId, id);
    await this.messages.update(
      { reservationId: id, senderUserId: Not(userId), readAt: IsNull() },
      { readAt: new Date() },
    );
    const list = await this.messages.find({
      where: { reservationId: id },
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
    if (!r.guestUserId)
      throw new BadRequestException(
        "This walk-in guest has no account to message",
      );
    const other = role === "guest" ? r.business.ownerUserId : r.guestUserId;
    await this.safety?.assertCanContact(userId, [other]);
    const saved = await this.messages.save(
      this.messages.create({
        reservationId: id,
        senderUserId: userId,
        body: body.trim(),
      }),
    );
    void this.notify(other, {
      type: "stay_message.received",
      title:
        role === "guest"
          ? `Message from ${r.guestName}`
          : `Message from ${r.business.name}`,
      body: body.trim().slice(0, 200),
      link: role === "guest" ? this.propertyLink(r) : this.guestLink(r),
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
    return this.reservations.findOneOrFail({
      where: { id },
      relations: { roomType: true },
    });
  }

  private async participant(userId: string, id: string) {
    const r = await this.reservations.findOne({
      where: { id },
      relations: { roomType: true },
    });
    if (!r) throw new NotFoundException("Booking not found");
    if (r.guestUserId && r.guestUserId === userId)
      return { r, role: "guest" as Role };
    if (r.business.ownerUserId === userId)
      return { r, role: "property" as Role };
    throw new NotFoundException("Booking not found");
  }

  private async asGuest(userId: string, id: string) {
    const { r, role } = await this.participant(userId, id);
    if (role !== "guest")
      throw new ForbiddenException("Only the guest can do this");
    return r;
  }

  private async asProperty(userId: string, id: string) {
    const { r, role } = await this.participant(userId, id);
    if (role !== "property")
      throw new ForbiddenException("Only the property can do this");
    return r;
  }

  /** Changes a booking only if it's still in one of `from`, so two people
   * at the front desk can't both act on it. */
  private async move(
    r: RoomReservation,
    from: ReservationStatus[],
    patch: Partial<RoomReservation>,
    stale: string,
  ) {
    const res = await this.reservations.update(
      { id: r.id, status: In(from) },
      patch,
    );
    if (!res.affected) throw new ConflictException(stale);
    return this.reload(r.id);
  }

  private guestLink(r: RoomReservation) {
    return `/account/stays/${r.id}`;
  }

  private propertyLink(r: RoomReservation) {
    return `/account/my-businesses/${r.businessId}/front-desk/${r.id}`;
  }

  private tellGuest(r: RoomReservation, title: string, body: string) {
    if (!r.guestUserId) return;
    void this.notify(r.guestUserId, {
      type: "stay.updated",
      title,
      body,
      link: this.guestLink(r),
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
      // A failed notification never undoes the booking change.
    }
  }

  private async unread(ids: string[], userId?: string) {
    if (!ids.length) return new Map<string, number>();
    const rows: Array<{ id: string; n: string }> = await this.messages
      .createQueryBuilder("m")
      .select("m.reservation_id", "id")
      .addSelect("COUNT(*)", "n")
      .where("m.reservation_id IN (:...ids)", { ids })
      .andWhere("m.read_at IS NULL")
      .andWhere(userId ? "m.sender_user_id != :userId" : "1=1", { userId })
      .groupBy("m.reservation_id")
      .getRawMany();
    return new Map(rows.map((row) => [row.id, Number(row.n)]));
  }

  private async viewMany(list: RoomReservation[], role: Role) {
    const viewer =
      role === "guest" ? list[0]?.guestUserId : list[0]?.business.ownerUserId;
    const unread = await this.unread(
      list.map((r) => r.id),
      viewer ?? undefined,
    );
    return list.map((r) => this.serialize(r, role, unread.get(r.id) ?? 0));
  }

  private async view(r: RoomReservation, role: Role) {
    return (await this.viewMany([r], role))[0];
  }

  private serialize(r: RoomReservation, role: Role, unreadMessages: number) {
    const b = r.business;
    return {
      id: r.id,
      code: r.code,
      source: r.source,
      status: r.status,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nights,
      rooms: r.rooms,
      adults: r.adults,
      children: r.children,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      arrivalTime: r.arrivalTime,
      specialRequests: r.specialRequests,
      roomTypeId: r.roomTypeId,
      roomName: r.roomName,
      roomImage: r.roomType?.images?.[0] ?? null,
      pricePerNight: r.pricePerNight,
      totalAmount: r.totalAmount,
      currency: r.currency,
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      paymentReference: r.paymentReference,
      paymentAccount: r.paymentAccount,
      propertyNote: r.propertyNote,
      roomNumbers: r.roomNumbers,
      confirmedAt: r.confirmedAt,
      checkedInAt: r.checkedInAt,
      checkedOutAt: r.checkedOutAt,
      cancelledAt: r.cancelledAt,
      createdAt: r.createdAt,
      property: {
        id: b.id,
        name: b.name,
        slug: b.slug,
        phone: b.phone,
        whatsapp: b.whatsapp,
        image: b.images?.[0] ?? null,
        address: b.linkedPlace
          ? [b.linkedPlace.city, b.linkedPlace.county?.name]
              .filter(Boolean)
              .join(", ")
          : null,
        latitude: b.linkedPlace?.latitude ?? null,
        longitude: b.linkedPlace?.longitude ?? null,
      },
      viewerRole: role,
      unreadMessages,
    };
  }
}
