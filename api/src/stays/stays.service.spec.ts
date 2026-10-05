import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { BusinessType } from "../businesses/entities/business.enums";
import { addDays, todayInLiberia } from "./availability";
import {
  ReservationStatus,
  StayPaymentMethod,
  StayPaymentStatus,
} from "./entities/stay.enums";
import { StaysService } from "./stays.service";

const today = todayInLiberia();
const inDays = (n: number) => addDays(today, n);

const business = {
  id: "biz-1",
  name: "Mamba Point Lodge",
  slug: "mamba-point-lodge",
  type: BusinessType.HOTEL,
  reviewStatus: "approved",
  ownerUserId: "owner-1",
  images: [],
  phone: "0777",
  whatsapp: null,
  linkedPlace: null,
};
const room = {
  id: "room-1",
  businessId: "biz-1",
  name: "Deluxe double",
  maxGuests: 2,
  totalRooms: 2,
  pricePerNight: 80,
  images: [],
  isActive: true,
};
const settings = {
  businessId: "biz-1",
  currency: "USD",
  checkInTime: "14:00",
  checkOutTime: "11:00",
  instantConfirm: false,
  payAtPropertyEnabled: true,
  mtnMomoNumber: "0886 111 222",
  orangeMoneyNumber: null,
  mobileMoneyAccountName: "Mamba Point Lodge",
  cancellationPolicy: null,
  houseRules: null,
};

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: "res-1",
    code: "K7Q2MP",
    business,
    businessId: "biz-1",
    guestUserId: "guest-1",
    roomTypeId: "room-1",
    roomType: room,
    checkIn: inDays(3),
    checkOut: inDays(5),
    nights: 2,
    rooms: 1,
    adults: 2,
    children: 0,
    guestName: "Comfort Doe",
    roomName: "Deluxe double",
    pricePerNight: 80,
    totalAmount: 160,
    currency: "USD",
    status: ReservationStatus.REQUESTED,
    paymentMethod: StayPaymentMethod.PAY_AT_PROPERTY,
    paymentStatus: StayPaymentStatus.PAY_AT_PROPERTY,
    paymentReference: null,
    ...overrides,
  };
}

function setup(held: { stays?: unknown[]; blocks?: unknown[] } = {}) {
  const manager = {
    query: jest.fn(async () => undefined),
    find: jest.fn(async (entity: { name: string }) =>
      entity.name === "RoomBlock" ? (held.blocks ?? []) : (held.stays ?? []),
    ),
    exists: jest.fn(async () => false),
    create: jest.fn((_e: unknown, x: Record<string, unknown>) => x),
    save: jest.fn(async (_e: unknown, x: Record<string, unknown>) => ({
      id: "res-1",
      ...x,
    })),
  };
  const reservations = {
    manager: {
      ...manager,
      transaction: jest.fn(async (fn: (m: typeof manager) => unknown) =>
        fn(manager),
      ),
    },
    find: jest.fn(async (): Promise<unknown[]> => []),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(async () => reservation()),
    update: jest.fn(async () => ({ affected: 1 })),
    exists: jest.fn(async () => false),
  };
  const qb: Record<string, jest.Mock> = {};
  for (const m of ["select", "addSelect", "where", "andWhere", "groupBy"])
    qb[m] = jest.fn(() => qb);
  qb.getRawMany = jest.fn(async (): Promise<unknown[]> => []);
  const messages = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn(),
    find: jest.fn(async () => []),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: "m-1", createdAt: new Date(), ...x })),
  };
  const businesses = { findOne: jest.fn(async () => business) };
  const roomTypes = {
    findOne: jest.fn(async () => room),
    find: jest.fn(async () => [room]),
    count: jest.fn(async () => 0),
    save: jest.fn(async (x) => x),
    create: jest.fn((x) => x),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const settingsRepo = {
    findOne: jest.fn(async () => settings),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };
  const notifications = { create: jest.fn(async () => undefined) };
  const service = new StaysService(
    businesses as never,
    roomTypes as never,
    {} as never,
    settingsRepo as never,
    reservations as never,
    messages as never,
    notifications as never,
  );
  return {
    service,
    reservations,
    manager,
    roomTypes,
    settingsRepo,
    notifications,
  };
}

const booking = {
  roomTypeId: "room-1",
  checkIn: inDays(3),
  checkOut: inDays(5),
  rooms: 1,
  adults: 2,
  guestName: "Comfort Doe",
  guestPhone: "0886 123 456",
  paymentMethod: StayPaymentMethod.PAY_AT_PROPERTY,
};

describe("StaysService booking", () => {
  it("prices the stay, holds the room and tells the front desk", async () => {
    const { service, manager, notifications } = setup();
    await service.reserve("guest-1", { ...booking, rooms: 2, adults: 3 });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["room-type:room-1"],
    );
    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        nights: 2,
        rooms: 2,
        totalAmount: 320,
        roomName: "Deluxe double",
        status: ReservationStatus.REQUESTED,
        paymentStatus: StayPaymentStatus.PAY_AT_PROPERTY,
        code: expect.stringMatching(/^[A-Z2-9]{6}$/),
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        type: "stay.requested",
        link: "/account/my-businesses/biz-1/front-desk/res-1",
      }),
    );
  });

  it("never sells more rooms than are left", async () => {
    const { service, manager } = setup({
      stays: [{ checkIn: inDays(4), checkOut: inDays(6), rooms: 1 }],
      blocks: [{ startDate: inDays(3), endDate: inDays(3), rooms: 1 }],
    });
    await expect(
      service.reserve("guest-1", { ...booking, rooms: 2, adults: 2 }),
    ).rejects.toThrow(/Only 1 Deluxe double room is left/);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it("checks dates, guests per room and payment", async () => {
    const { service } = setup();
    await expect(
      service.reserve("guest-1", { ...booking, checkIn: inDays(-1) }),
    ).rejects.toThrow(/past/);
    await expect(
      service.reserve("guest-1", { ...booking, checkOut: booking.checkIn }),
    ).rejects.toThrow(/after check-in/);
    await expect(
      service.reserve("guest-1", { ...booking, adults: 3 }),
    ).rejects.toThrow(/sleeps up to 2/);
    await expect(
      service.reserve("guest-1", {
        ...booking,
        paymentMethod: StayPaymentMethod.ORANGE_MONEY,
        paymentReference: "OM1234",
      }),
    ).rejects.toThrow(/doesn't take Orange Money/);
    await expect(
      service.reserve("guest-1", {
        ...booking,
        paymentMethod: StayPaymentMethod.MTN_MOMO,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(service.reserve("owner-1", booking)).rejects.toThrow(
      /your own property/,
    );
  });

  it("confirms instantly when the property allows it, but not before a mobile money check", async () => {
    const { service, manager, settingsRepo } = setup();
    settingsRepo.findOne.mockResolvedValue({
      ...settings,
      instantConfirm: true,
    });
    await service.reserve("guest-1", booking);
    expect(manager.save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: ReservationStatus.CONFIRMED }),
    );
    await service.reserve("guest-1", {
      ...booking,
      paymentMethod: StayPaymentMethod.MTN_MOMO,
      paymentReference: "MP1234",
    });
    expect(manager.save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: ReservationStatus.REQUESTED,
        paymentStatus: StayPaymentStatus.AWAITING_VERIFICATION,
        paymentAccount: "0886 111 222",
      }),
    );
  });

  it("turns a reused transaction ID into a clear message", async () => {
    const { service, manager } = setup();
    manager.save.mockRejectedValueOnce({ code: "23505" });
    await expect(
      service.reserve("guest-1", {
        ...booking,
        paymentMethod: StayPaymentMethod.MTN_MOMO,
        paymentReference: "MP1234",
      }),
    ).rejects.toThrow(ConflictException);
  });
});

describe("StaysService front desk", () => {
  it("won't confirm a mobile money booking until the payment is checked", async () => {
    const { service, reservations } = setup();
    reservations.findOne.mockResolvedValue(
      reservation({
        paymentMethod: StayPaymentMethod.MTN_MOMO,
        paymentStatus: StayPaymentStatus.AWAITING_VERIFICATION,
      }),
    );
    await expect(
      service.respond("owner-1", "res-1", "confirm"),
    ).rejects.toThrow(/Check the mobile money payment first/);
    await service.verifyPayment("owner-1", "res-1", true);
    expect(reservations.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "res-1" }),
      expect.objectContaining({
        paymentStatus: StayPaymentStatus.PAID,
        status: ReservationStatus.CONFIRMED,
      }),
    );
  });

  it("owes a refund when declining a paid booking", async () => {
    const { service, reservations, notifications } = setup();
    reservations.findOne.mockResolvedValue(
      reservation({ paymentStatus: StayPaymentStatus.PAID }),
    );
    await service.respond("owner-1", "res-1", "decline", "We're full");
    expect(reservations.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: ReservationStatus.DECLINED,
        paymentStatus: StayPaymentStatus.REFUND_DUE,
        propertyNote: "We're full",
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "guest-1",
      expect.objectContaining({ link: "/account/stays/res-1" }),
    );
  });

  it("checks in on the day, not before, and settles desk payment at check-out", async () => {
    const { service, reservations } = setup();
    reservations.findOne.mockResolvedValue(
      reservation({ status: ReservationStatus.CONFIRMED }),
    );
    await expect(service.checkIn("owner-1", "res-1")).rejects.toThrow(
      /Check-in opens/,
    );
    reservations.findOne.mockResolvedValue(
      reservation({ status: ReservationStatus.CONFIRMED, checkIn: today }),
    );
    await service.checkIn("owner-1", "res-1", " 12, 14 ");
    expect(reservations.update).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: ReservationStatus.CHECKED_IN,
        roomNumbers: "12, 14",
      }),
    );
    reservations.findOne.mockResolvedValue(
      reservation({ status: ReservationStatus.CHECKED_IN, checkIn: today }),
    );
    await service.checkOut("owner-1", "res-1");
    expect(reservations.update).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: ReservationStatus.CHECKED_OUT,
        paymentStatus: StayPaymentStatus.PAID,
      }),
    );
  });

  it("says so when someone else already acted on the booking", async () => {
    const { service, reservations } = setup();
    reservations.findOne.mockResolvedValue(reservation());
    reservations.update.mockResolvedValueOnce({ affected: 0 });
    await expect(
      service.respond("owner-1", "res-1", "confirm"),
    ).rejects.toThrow(/already answered/);
  });

  it("hides a booking from anyone but the guest and the property", async () => {
    const { service, reservations } = setup();
    reservations.findOne.mockResolvedValue(reservation());
    await expect(service.get("stranger", "res-1")).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.checkOut("guest-1", "res-1")).rejects.toThrow(
      /Only the property/,
    );
  });

  it("refunds the guest when they cancel after paying", async () => {
    const { service, reservations } = setup();
    reservations.findOne.mockResolvedValue(
      reservation({
        status: ReservationStatus.CONFIRMED,
        paymentStatus: StayPaymentStatus.PAID,
      }),
    );
    await service.cancel("guest-1", "res-1");
    expect(reservations.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: ReservationStatus.CANCELLED,
        paymentStatus: StayPaymentStatus.REFUND_DUE,
      }),
    );
  });

  it("records a walk-in as checked in so online guests see the right rooms left", async () => {
    const { service, manager } = setup({
      stays: [{ checkIn: today, checkOut: inDays(2), rooms: 1 }],
    });
    await service.walkIn("owner-1", "biz-1", {
      roomTypeId: "room-1",
      checkOut: inDays(1),
      rooms: 1,
      adults: 1,
      guestName: "Walk-in guest",
      paid: true,
    });
    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: "walk_in",
        status: ReservationStatus.CHECKED_IN,
        guestUserId: null,
        paymentStatus: StayPaymentStatus.PAID,
      }),
    );
    await expect(
      service.walkIn("owner-1", "biz-1", {
        roomTypeId: "room-1",
        checkOut: inDays(1),
        rooms: 2,
        adults: 2,
        guestName: "Group",
      }),
    ).rejects.toThrow(/Only 1/);
  });

  it("keeps at least one way to pay", async () => {
    const { service } = setup();
    await expect(
      service.saveSettings("owner-1", "biz-1", {
        payAtPropertyEnabled: false,
        mtnMomoNumber: "",
      }),
    ).rejects.toThrow(/at least one way to pay/);
  });
});
