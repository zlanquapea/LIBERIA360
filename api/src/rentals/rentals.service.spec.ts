import { NotFoundException } from "@nestjs/common";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";
import { CarListingBlockedDate } from "../car-listings/entities/car-listing-blocked-date.entity";
import { CarRental } from "./entities/car-rental.entity";
import {
  FuelLevel,
  RentalPaymentMethod,
  RentalPaymentStatus,
  RentalStatus,
  RentalUnit,
} from "./entities/rental.enums";
import { addDays, todayInLiberia } from "./rental-time";
import { RentalsService } from "./rentals.service";

const today = todayInLiberia();
const inDays = (n: number) => addDays(today, n);

const car = {
  id: "car-1",
  ownerUserId: "owner-1",
  title: "Toyota RAV4 2021",
  images: ["cars/rav4.jpg"],
  pickupLocation: "RIA airport arrivals",
  pricePerDay: 60,
  pricePerHour: null,
  minRentalDays: 1,
  minRentalHours: null,
  withDriverAvailable: true,
  driverFeePerDay: 25,
  driverFeePerHour: null,
  additionalDriverAllowed: false,
  additionalDriverFee: null,
  deliveryAvailable: true,
  deliveryFee: 20,
  securityDeposit: 200,
  mileageLimitPerDay: 150,
  excessMileageFee: 0.5,
  minDriverAge: 23,
  instantBookEnabled: false,
  contactPhone: "0777 000 111",
  contactWhatsapp: null,
};

const settings = {
  ownerUserId: "owner-1",
  cashAtPickupEnabled: true,
  mtnMomoNumber: "0886 222 333",
  orangeMoneyNumber: "0777 444 555",
  mobileMoneyAccountName: "Kollie Car Hire",
};

function rental(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    code: "K7Q2MP",
    carListingId: "car-1",
    carListing: car,
    ownerUserId: "owner-1",
    renterUserId: "renter-1",
    status: RentalStatus.REQUESTED,
    rentalUnit: RentalUnit.DAY,
    pickupDate: inDays(2),
    returnDate: inDays(4),
    pickupTime: "09:00",
    returnTime: "17:00",
    units: 2,
    withDriver: false,
    renterName: "Comfort Doe",
    carTitle: car.title,
    totalAmount: 120,
    depositAmount: 200,
    depositCollected: null,
    pickupOdometer: null,
    paymentMethod: RentalPaymentMethod.CASH_AT_PICKUP,
    paymentStatus: RentalPaymentStatus.PAY_AT_PICKUP,
    paymentReference: null,
    extraCharges: [],
    ...overrides,
  };
}

function setup(
  busy: { rentals?: unknown[]; bookings?: unknown[]; blocks?: unknown[] } = {},
) {
  const manager = {
    query: jest.fn(async () => undefined),
    find: jest.fn(async (entity: unknown) =>
      entity === CarRental
        ? (busy.rentals ?? [])
        : entity === Booking
          ? (busy.bookings ?? [])
          : entity === CarListingBlockedDate
            ? (busy.blocks ?? [])
            : [],
    ),
    exists: jest.fn(async () => false),
    create: jest.fn((_e: unknown, x: Record<string, unknown>) => x),
    save: jest.fn(async (_e: unknown, x: Record<string, unknown>) => ({
      id: "r-1",
      ...x,
    })),
  };
  const rentals = {
    manager: {
      ...manager,
      transaction: jest.fn(async (fn: (m: typeof manager) => unknown) =>
        fn(manager),
      ),
    },
    find: jest.fn(async (): Promise<unknown[]> => []),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(async () => rental()),
    update: jest.fn(async () => ({ affected: 1 })),
  };
  const qb: Record<string, jest.Mock> = {};
  for (const m of ["select", "addSelect", "where", "andWhere", "groupBy"])
    qb[m] = jest.fn(() => qb);
  qb.getRawMany = jest.fn(async (): Promise<unknown[]> => []);
  const messages = { createQueryBuilder: jest.fn(() => qb) };
  const settingsRepo = {
    findOne: jest.fn(async () => settings),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
  };
  const cars = {
    findOne: jest.fn(async () => car),
    find: jest.fn(async () => [car]),
  };
  const notifications = { create: jest.fn(async () => undefined) };
  const service = new RentalsService(
    rentals as never,
    messages as never,
    settingsRepo as never,
    cars as never,
    notifications as never,
  );
  return { service, rentals, manager, settingsRepo, cars, notifications };
}

const booking = {
  carListingId: "car-1",
  pickupDate: inDays(2),
  returnDate: inDays(5),
  pickupTime: "09:00",
  returnTime: "17:00",
  renterName: "Comfort Doe",
  renterPhone: "0886 123 456",
  licenceNumber: "LR-123456",
  ageConfirmed: true,
  paymentMethod: RentalPaymentMethod.CASH_AT_PICKUP,
};

describe("RentalsService booking", () => {
  it("prices the trip line by line and tells the owner", async () => {
    const { service, manager, notifications } = setup();
    await service.book("renter-1", {
      ...booking,
      withDriver: true,
      delivery: true,
      deliveryAddress: "Mamba Point Hotel",
    });
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      ["car-1"],
    );
    expect(manager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        units: 3,
        baseAmount: 180,
        driverFee: 75,
        deliveryFee: 20,
        totalAmount: 275,
        depositAmount: 200,
        status: RentalStatus.REQUESTED,
        paymentStatus: RentalPaymentStatus.PAY_AT_PICKUP,
        carTitle: "Toyota RAV4 2021",
      }),
    );
    expect(notifications.create).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        type: "rental.requested",
        link: "/account/my-car-listings/rentals/r-1",
      }),
    );
  });

  it("won't double-book against a rental, an older request or a blocked day", async () => {
    for (const busy of [
      {
        rentals: [
          rental({
            status: RentalStatus.CONFIRMED,
            pickupDate: inDays(5),
            returnDate: inDays(6),
          }),
        ],
      },
      {
        bookings: [
          {
            requestedDate: inDays(3),
            requestedEndDate: inDays(3),
            rentalUnit: null,
            status: BookingStatus.PENDING,
          },
        ],
      },
      { blocks: [{ startDate: inDays(4), endDate: inDays(4) }] },
    ]) {
      const { service, manager } = setup(busy);
      await expect(service.book("renter-1", booking)).rejects.toThrow(
        /already booked|off the road/,
      );
      expect(manager.save).not.toHaveBeenCalled();
    }
  });

  it("needs a licence and the minimum age unless a chauffeur drives", async () => {
    const { service } = setup();
    await expect(
      service.book("renter-1", { ...booking, licenceNumber: "" }),
    ).rejects.toThrow(/licence/);
    await expect(
      service.book("renter-1", { ...booking, ageConfirmed: false }),
    ).rejects.toThrow(/at least 23/);
    await expect(
      service.book("renter-1", {
        ...booking,
        licenceNumber: "",
        ageConfirmed: false,
        withDriver: true,
      }),
    ).resolves.toBeDefined();
  });

  it("checks dates, delivery, payment and own-car", async () => {
    const { service, settingsRepo } = setup();
    await expect(
      service.book("renter-1", { ...booking, pickupDate: inDays(-1) }),
    ).rejects.toThrow(/past/);
    await expect(
      service.book("renter-1", { ...booking, returnDate: inDays(1) }),
    ).rejects.toThrow(/before pickup/);
    await expect(
      service.book("renter-1", { ...booking, delivery: true }),
    ).rejects.toThrow(/delivered/);
    await expect(
      service.book("renter-1", {
        ...booking,
        rentalUnit: RentalUnit.HOUR,
      }),
    ).rejects.toThrow(/by the hour/);
    await expect(
      service.book("renter-1", {
        ...booking,
        paymentMethod: RentalPaymentMethod.MTN_MOMO,
      }),
    ).rejects.toThrow(/transaction ID/);
    settingsRepo.findOne.mockResolvedValueOnce({
      ...settings,
      orangeMoneyNumber: null,
    } as never);
    await expect(
      service.book("renter-1", {
        ...booking,
        paymentMethod: RentalPaymentMethod.ORANGE_MONEY,
        paymentReference: "OM1234",
      }),
    ).rejects.toThrow(/doesn't take Orange Money/);
    await expect(service.book("owner-1", booking)).rejects.toThrow(
      /your own car/,
    );
  });

  it("confirms instantly only when nothing needs checking", async () => {
    const { service, manager, cars } = setup();
    cars.findOne.mockResolvedValue({
      ...car,
      instantBookEnabled: true,
    } as never);
    await service.book("renter-1", booking);
    expect(manager.save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ status: RentalStatus.CONFIRMED }),
    );
    await service.book("renter-1", {
      ...booking,
      paymentMethod: RentalPaymentMethod.MTN_MOMO,
      paymentReference: "MP9999",
    });
    expect(manager.save).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: RentalStatus.REQUESTED,
        paymentStatus: RentalPaymentStatus.AWAITING_VERIFICATION,
        paymentAccount: "0886 222 333",
      }),
    );
  });
});

describe("RentalsService owner desk", () => {
  it("confirms a mobile money rental only through the payment check", async () => {
    const { service, rentals } = setup();
    rentals.findOne.mockResolvedValue(
      rental({
        paymentMethod: RentalPaymentMethod.MTN_MOMO,
        paymentStatus: RentalPaymentStatus.AWAITING_VERIFICATION,
      }),
    );
    await expect(service.respond("owner-1", "r-1", "confirm")).rejects.toThrow(
      /Check the mobile money payment first/,
    );
    await service.verifyPayment("owner-1", "r-1", true);
    expect(rentals.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r-1" }),
      expect.objectContaining({
        status: RentalStatus.CONFIRMED,
        paymentStatus: RentalPaymentStatus.PAID,
      }),
    );
  });

  it("hands over only on the day, with the licence checked, and takes the cash", async () => {
    const { service, rentals } = setup();
    rentals.findOne.mockResolvedValue(
      rental({ status: RentalStatus.CONFIRMED }),
    );
    await expect(
      service.handover("owner-1", "r-1", { licenceChecked: true }),
    ).rejects.toThrow(/Pickup is on/);
    rentals.findOne.mockResolvedValue(
      rental({ status: RentalStatus.CONFIRMED, pickupDate: today }),
    );
    await expect(
      service.handover("owner-1", "r-1", { licenceChecked: false }),
    ).rejects.toThrow(/licence/);
    await service.handover("owner-1", "r-1", {
      licenceChecked: true,
      odometer: 42000,
      fuel: FuelLevel.FULL,
      depositCollected: 200,
      paymentCollected: true,
    });
    expect(rentals.update).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: RentalStatus.ON_TRIP,
        pickupOdometer: 42000,
        pickupFuel: FuelLevel.FULL,
        depositCollected: 200,
        paymentStatus: RentalPaymentStatus.PAID,
      }),
    );
  });

  it("closes the trip with readings, extra charges and the deposit", async () => {
    const { service, rentals } = setup();
    rentals.findOne.mockResolvedValue(
      rental({
        status: RentalStatus.ON_TRIP,
        pickupOdometer: 42000,
        depositCollected: 200,
        paymentStatus: RentalPaymentStatus.PAID,
      }),
    );
    await expect(
      service.returnCar("owner-1", "r-1", { odometer: 41000 }),
    ).rejects.toThrow(/read 42000/);
    await expect(
      service.returnCar("owner-1", "r-1", { depositReturned: 250 }),
    ).rejects.toThrow(/Only 200/);
    await service.returnCar("owner-1", "r-1", {
      odometer: 42500,
      fuel: FuelLevel.HALF,
      extraCharges: [
        { label: "Extra 200 miles", amount: 100 },
        { label: "Fuel top-up", amount: 30 },
        { label: "  ", amount: 5 },
      ],
      depositReturned: 70,
    });
    expect(rentals.update).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: RentalStatus.RETURNED,
        extrasTotal: 130,
        extraCharges: [
          { label: "Extra 200 miles", amount: 100 },
          { label: "Fuel top-up", amount: 30 },
        ],
        depositReturned: 70,
      }),
    );
  });

  it("refunds a paid renter who cancels, and hides rentals from strangers", async () => {
    const { service, rentals } = setup();
    rentals.findOne.mockResolvedValue(
      rental({
        status: RentalStatus.CONFIRMED,
        paymentStatus: RentalPaymentStatus.PAID,
      }),
    );
    await service.cancel("renter-1", "r-1");
    expect(rentals.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: RentalStatus.CANCELLED,
        paymentStatus: RentalPaymentStatus.REFUND_DUE,
      }),
    );
    await expect(service.get("stranger", "r-1")).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      service.handover("renter-1", "r-1", { licenceChecked: true }),
    ).rejects.toThrow(/Only the car's owner/);
  });

  it("says so when the rental already moved on", async () => {
    const { service, rentals } = setup();
    rentals.findOne.mockResolvedValue(rental());
    rentals.update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.respond("owner-1", "r-1", "confirm")).rejects.toThrow(
      /already answered/,
    );
  });

  it("keeps at least one way to pay", async () => {
    const { service } = setup();
    await expect(
      service.saveSettings("owner-1", {
        cashAtPickupEnabled: false,
        mtnMomoNumber: "",
        orangeMoneyNumber: "",
      }),
    ).rejects.toThrow(/at least one way to pay/);
  });
});
