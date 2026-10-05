import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { TripVisibility } from "../itineraries/entities/itinerary.enums";
import {
  TripBookingPaymentStatus,
  TripBookingStatus,
  TripPaymentMethod,
  TripPaymentPlan,
  TripPaymentRecordStatus,
} from "./entities/group-trip.enums";
import { TripBooking } from "./entities/trip-booking.entity";
import { TripBookingPayment } from "./entities/trip-booking-payment.entity";
import {
  amountToHold,
  outstanding,
  paymentStatusFor,
  spotsLeft,
  tripBookingCode,
} from "./group-trip-money";
import { GroupTripsService } from "./group-trips.service";

const inDays = (n: number) => new Date(Date.now() + n * 864e5);

const trip = {
  id: "trip-1",
  userId: "host-1",
  title: "The Buchanan Escape",
  visibility: TripVisibility.PUBLIC,
  startDate: inDays(20),
  endDate: inDays(22),
  cancelledAt: null,
  isFeaturedTemplate: false,
  coverImage: null,
  destination: null,
};

const hosting = {
  itineraryId: "trip-1",
  open: true,
  price: 150,
  currency: "USD",
  depositAmount: 50,
  balanceDueDate: null,
  bookingDeadline: null,
  spots: 30,
  maxPerBooking: 4,
  requireApproval: false,
  cashEnabled: true,
  mtnMomoNumber: "0886 555 101",
  orangeMoneyNumber: null,
  accountName: "Tuzee Tours",
  meetingPoint: "UL campus gate",
  departureTime: "07:00",
  contactPhone: "0886 555 101",
};

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "b-1",
    code: "HEFCN3",
    itineraryId: "trip-1",
    itinerary: trip,
    hostUserId: "host-1",
    userId: "traveller-1",
    user: { name: "Musu" },
    status: TripBookingStatus.PENDING,
    seats: 2,
    travellers: [
      { name: "Musu", boarded: false },
      { name: "Kollie", boarded: false },
    ],
    contactName: "Musu",
    phone: "0886 123 456",
    unitPrice: 150,
    totalAmount: 300,
    currency: "USD",
    depositAmount: 100,
    paymentPlan: TripPaymentPlan.DEPOSIT,
    paymentMethod: TripPaymentMethod.MTN_MOMO,
    amountPaid: 0,
    paymentStatus: TripBookingPaymentStatus.UNPAID,
    addedAsMember: false,
    payments: [] as Array<Record<string, unknown>>,
    createdAt: new Date(),
    ...overrides,
  };
}

function setup(
  opts: {
    seats?: Array<{ status: TripBookingStatus; seats: number }>;
    hosting?: Record<string, unknown> | null;
    booking?: ReturnType<typeof booking>;
  } = {},
) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of [
    "select",
    "addSelect",
    "where",
    "andWhere",
    "groupBy",
    "addGroupBy",
  ])
    qb[m] = jest.fn(() => qb);
  qb.getRawMany = jest.fn(async () =>
    (opts.seats ?? []).map((s) => ({ id: "trip-1", ...s })),
  );
  let current = opts.booking ?? booking();
  const manager = {
    query: jest.fn(async () => undefined),
    exists: jest.fn(async () => false),
    getRepository: jest.fn(() => ({ createQueryBuilder: () => qb })),
    create: jest.fn((_e: unknown, x: Record<string, unknown>) => x),
    save: jest.fn(async (e: unknown, x: Record<string, unknown>) => {
      if (e === TripBooking) {
        current = booking({ ...x, id: "b-1" });
        return current;
      }
      return { id: "p-1", ...x };
    }),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const bookings = {
    manager: {
      transaction: jest.fn(async (fn: (m: typeof manager) => unknown) =>
        fn(manager),
      ),
    },
    createQueryBuilder: jest.fn(() => qb),
    exists: jest.fn(async () => false),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => current),
    findOneOrFail: jest.fn(async () => current),
    update: jest.fn(async (_where: unknown, patch: Record<string, unknown>) => {
      current = { ...current, ...patch };
      return { affected: 1 };
    }),
  };
  const hosted = {
    findOne: jest.fn(async () =>
      opts.hosting === null ? null : { ...hosting, ...(opts.hosting ?? {}) },
    ),
    findOneOrFail: jest.fn(async () => ({
      ...hosting,
      ...(opts.hosting ?? {}),
    })),
    find: jest.fn(async () => [{ ...hosting, ...(opts.hosting ?? {}) }]),
    exists: jest.fn(async () => true),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const payments = {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const itineraries = {
    findOne: jest.fn(async () => ({ ...trip })),
    findOneOrFail: jest.fn(async () => ({ ...trip })),
    save: jest.fn(async (x) => x),
  };
  const collaborators = {
    exists: jest.fn(async () => false),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const notifications = { create: jest.fn(async () => undefined) };
  const tripChat = { postSystemMessage: jest.fn(async () => undefined) };
  const service = new GroupTripsService(
    hosted as never,
    bookings as never,
    payments as never,
    itineraries as never,
    collaborators as never,
    notifications as never,
    tripChat as never,
  );
  return {
    service,
    manager,
    bookings,
    hosted,
    payments,
    itineraries,
    collaborators,
    notifications,
    setBooking: (b: ReturnType<typeof booking>) => (current = b),
  };
}

const book = {
  seats: 2,
  travellers: ["Musu", "Kollie"],
  contactName: "Musu",
  phone: "0886 123 456",
  paymentMethod: TripPaymentMethod.MTN_MOMO,
  paymentPlan: TripPaymentPlan.DEPOSIT,
  paymentReference: "MP2610.1234",
};

describe("group trip money", () => {
  it("works out the booking's money status from what was received", () => {
    const b = {
      status: TripBookingStatus.PENDING,
      totalAmount: 300,
      depositAmount: 100,
    };
    expect(paymentStatusFor({ ...b, amountPaid: 0 })).toBe("unpaid");
    expect(paymentStatusFor({ ...b, amountPaid: 100 })).toBe("part_paid");
    expect(paymentStatusFor({ ...b, amountPaid: 300 })).toBe("paid");
    expect(
      paymentStatusFor({
        ...b,
        status: TripBookingStatus.CANCELLED,
        amountPaid: 100,
      }),
    ).toBe("refund_due");
    expect(
      paymentStatusFor({
        ...b,
        status: TripBookingStatus.CANCELLED,
        amountPaid: 100,
        paymentStatus: TripBookingPaymentStatus.REFUNDED,
      }),
    ).toBe("refunded");
    expect(
      paymentStatusFor({
        ...b,
        totalAmount: 0,
        depositAmount: null,
        amountPaid: 0,
      }),
    ).toBe("free");
    expect(amountToHold({ ...b, amountPaid: 0 })).toBe(100);
    expect(amountToHold({ ...b, depositAmount: null, amountPaid: 0 })).toBe(
      300,
    );
    expect(outstanding({ ...b, amountPaid: 120.5 })).toBe(179.5);
    expect(spotsLeft(30, 32)).toBe(0);
  });

  it("makes codes that are easy to read out", () => {
    expect(tripBookingCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});

describe("GroupTripsService booking", () => {
  it("holds spots for a deposit sent by MoMo and asks the organiser to check it", async () => {
    const { service, manager, notifications } = setup();
    await service.book("traveller-1", "trip-1", book);
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["trip-1"],
    );
    expect(manager.save).toHaveBeenCalledWith(
      TripBooking,
      expect.objectContaining({
        status: TripBookingStatus.PENDING,
        totalAmount: 300,
        depositAmount: 100,
        paymentStatus: TripBookingPaymentStatus.UNPAID,
        travellers: [
          { name: "Musu", boarded: false },
          { name: "Kollie", boarded: false },
        ],
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      TripBookingPayment,
      expect.objectContaining({
        amount: 100,
        method: TripPaymentMethod.MTN_MOMO,
        account: "0886 555 101",
        status: TripPaymentRecordStatus.AWAITING_VERIFICATION,
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "host-1",
      expect.objectContaining({
        type: "trip_booking.requested",
        title: "New booking — payment to check",
        link: "/trips/trip-1/host?booking=b-1",
      }),
    );
  });

  it("confirms a free trip straight away and adds the traveller to the trip", async () => {
    const { service, manager, collaborators } = setup({
      hosting: { price: 0, depositAmount: null },
    });
    await service.book("traveller-1", "trip-1", {
      ...book,
      paymentMethod: undefined,
      paymentPlan: undefined,
      paymentReference: undefined,
    });
    expect(manager.save).toHaveBeenCalledWith(
      TripBooking,
      expect.objectContaining({
        status: TripBookingStatus.CONFIRMED,
        totalAmount: 0,
        paymentStatus: TripBookingPaymentStatus.FREE,
      }),
    );
    expect(collaborators.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "traveller-1", role: "viewer" }),
    );
  });

  it("won't oversell, but can put people on the waitlist", async () => {
    const full = [{ status: TripBookingStatus.CONFIRMED, seats: 29 }];
    const a = setup({ seats: full });
    await expect(a.service.book("traveller-1", "trip-1", book)).rejects.toThrow(
      "Only 1 spot left",
    );
    const b = setup({ seats: full });
    await b.service.book("traveller-1", "trip-1", {
      ...book,
      paymentReference: undefined,
      joinWaitlist: true,
    });
    expect(b.manager.save).toHaveBeenCalledWith(
      TripBooking,
      expect.objectContaining({ status: TripBookingStatus.WAITLISTED }),
    );
    expect(b.manager.save).not.toHaveBeenCalledWith(
      TripBookingPayment,
      expect.anything(),
    );
  });

  it("checks payment the organiser can actually take", async () => {
    const { service } = setup({ hosting: { depositAmount: null } });
    await expect(
      service.book("traveller-1", "trip-1", {
        ...book,
        paymentMethod: TripPaymentMethod.ORANGE_MONEY,
      }),
    ).rejects.toThrow("doesn't take Orange Money");
    await expect(service.book("traveller-1", "trip-1", book)).rejects.toThrow(
      "doesn't take deposits",
    );
    await expect(
      service.book("traveller-1", "trip-1", {
        ...book,
        paymentPlan: TripPaymentPlan.FULL,
        paymentReference: "",
      }),
    ).rejects.toThrow("transaction ID");
  });

  it("turns away the organiser, closed trips and a second booking", async () => {
    const own = setup();
    await expect(own.service.book("host-1", "trip-1", book)).rejects.toThrow(
      BadRequestException,
    );
    const closed = setup({ hosting: { open: false } });
    await expect(
      closed.service.book("traveller-1", "trip-1", book),
    ).rejects.toThrow("closed bookings");
    const again = setup();
    again.bookings.exists.mockResolvedValue(true);
    await expect(
      again.service.book("traveller-1", "trip-1", book),
    ).rejects.toThrow(ConflictException);
  });
});

describe("GroupTripsService organiser", () => {
  it("opens a trip for bookings and makes it public", async () => {
    const { service, hosted, itineraries } = setup({ hosting: null });
    await service.saveHosting("host-1", "trip-1", {
      price: 150,
      currency: "USD",
      spots: 30,
      depositAmount: 50,
      includes: ["Transportation", " Transportation ", "Souvenirs"],
      mtnMomoNumber: "0886 555 101",
      accountName: "Tuzee Tours",
    });
    expect(hosted.save).toHaveBeenCalledWith(
      expect.objectContaining({
        price: 150,
        depositAmount: 50,
        includes: ["Transportation", "Souvenirs"],
      }),
    );
    expect(itineraries.save).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: TripVisibility.PUBLIC }),
    );
  });

  it("keeps hosting rules sensible", async () => {
    const { service } = setup({
      seats: [{ status: TripBookingStatus.CONFIRMED, seats: 12 }],
    });
    const base = { price: 150, currency: "USD" as const, spots: 30 };
    await expect(
      service.saveHosting("host-1", "trip-1", { ...base, depositAmount: 150 }),
    ).rejects.toThrow("deposit must be less");
    await expect(
      service.saveHosting("host-1", "trip-1", { ...base, spots: 10 }),
    ).rejects.toThrow("12 spots already booked");
    await expect(
      service.saveHosting("host-1", "trip-1", { ...base, cashEnabled: false }),
    ).rejects.toThrow("at least one way");
    await expect(
      service.saveHosting("someone-else", "trip-1", base),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("confirms the booking once the deposit is found", async () => {
    const pending = booking({
      payments: [
        {
          id: "p-1",
          amount: 100,
          method: TripPaymentMethod.MTN_MOMO,
          status: TripPaymentRecordStatus.AWAITING_VERIFICATION,
          createdAt: new Date(),
        },
      ],
    });
    const { service, bookings, collaborators, notifications, setBooking } =
      setup({ booking: pending });
    // Once checked, the payment counts as received.
    bookings.findOneOrFail.mockImplementation(async () => {
      const b = await bookings.findOne();
      return {
        ...b,
        payments: [
          { ...pending.payments[0], status: TripPaymentRecordStatus.RECEIVED },
        ],
      };
    });
    await service.reviewPayment("host-1", "b-1", "p-1", true);
    expect(bookings.update).toHaveBeenCalledWith("b-1", {
      amountPaid: 100,
      paymentStatus: TripBookingPaymentStatus.PART_PAID,
    });
    expect(bookings.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "b-1" }),
      expect.objectContaining({ status: TripBookingStatus.CONFIRMED }),
    );
    expect(collaborators.save).toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      "traveller-1",
      expect.objectContaining({ type: "trip_booking.confirmed" }),
    );
    setBooking(booking());
  });

  it("only lets travellers send mobile money, and never more than is owed", async () => {
    const { service } = setup({
      booking: booking({
        status: TripBookingStatus.CONFIRMED,
        amountPaid: 100,
      }),
    });
    await expect(
      service.pay("traveller-1", "b-1", {
        amount: 50,
        method: TripPaymentMethod.CASH,
      }),
    ).rejects.toThrow("Hand cash to the organiser");
    await expect(
      service.pay("traveller-1", "b-1", {
        amount: 250,
        method: TripPaymentMethod.MTN_MOMO,
        reference: "MP1",
      }),
    ).rejects.toThrow("Only 200 USD is still owed");
  });

  it("marks a refund due when a paid traveller cancels, and frees their spot", async () => {
    const paid = booking({
      status: TripBookingStatus.CONFIRMED,
      amountPaid: 100,
      addedAsMember: true,
      payments: [
        {
          id: "p-1",
          amount: 100,
          method: TripPaymentMethod.MTN_MOMO,
          status: TripPaymentRecordStatus.RECEIVED,
          createdAt: new Date(),
        },
      ],
    });
    const { service, bookings, collaborators, notifications } = setup({
      booking: paid,
    });
    await service.cancel("traveller-1", "b-1");
    expect(bookings.update).toHaveBeenCalledWith("b-1", {
      amountPaid: 100,
      paymentStatus: TripBookingPaymentStatus.REFUND_DUE,
    });
    expect(collaborators.delete).toHaveBeenCalledWith({
      itineraryId: "trip-1",
      userId: "traveller-1",
    });
    expect(notifications.create).toHaveBeenCalledWith(
      "host-1",
      expect.objectContaining({ type: "trip_booking.cancelled" }),
    );
  });

  it("ticks travellers onto the bus, one by one or all together", async () => {
    const { service, bookings } = setup({
      booking: booking({ status: TripBookingStatus.CONFIRMED }),
    });
    await service.board("host-1", "b-1", { traveller: 1, boarded: true });
    expect(bookings.update).toHaveBeenCalledWith("b-1", {
      travellers: [
        { name: "Musu", boarded: false },
        { name: "Kollie", boarded: true },
      ],
    });
    await expect(
      service.board("traveller-1", "b-1", { boarded: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("won't board someone who isn't confirmed", async () => {
    const { service } = setup();
    await expect(
      service.board("host-1", "b-1", { boarded: true }),
    ).rejects.toThrow("Only confirmed travellers");
  });

  it("hides a booking from anyone but the traveller and organiser", async () => {
    const { service } = setup();
    await expect(service.get("stranger", "b-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
