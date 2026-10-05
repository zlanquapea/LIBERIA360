import { RentalUnit } from "./entities/rental.enums";
import {
  excessMileage,
  heldWindow,
  overlaps,
  priceRental,
  rentalCode,
  rentalUnits,
  tripWindow,
} from "./rental-time";

const day = (pickupDate: string, returnDate: string) => ({
  rentalUnit: RentalUnit.DAY,
  pickupDate,
  returnDate,
  pickupTime: "09:00",
  returnTime: "17:00",
});

const car = {
  pricePerDay: 60,
  pricePerHour: 12,
  withDriverAvailable: true,
  driverFeePerDay: 25,
  driverFeePerHour: 5,
  additionalDriverAllowed: true,
  additionalDriverFee: 15,
  deliveryAvailable: false,
  deliveryFee: 20,
};

describe("rental timing", () => {
  it("counts days between pickup and return, at least one", () => {
    expect(rentalUnits(day("2026-10-10", "2026-10-13"))).toBe(3);
    expect(rentalUnits(day("2026-10-10", "2026-10-10"))).toBe(1);
    expect(
      rentalUnits({
        rentalUnit: RentalUnit.HOUR,
        pickupDate: "2026-10-10",
        returnDate: "2026-10-10",
        pickupTime: "09:00",
        returnTime: "12:30",
      }),
    ).toBe(4);
  });

  it("keeps the return day for the owner, and lets hourly trips share a day", () => {
    const a = tripWindow(day("2026-10-10", "2026-10-12"));
    expect(overlaps(a, tripWindow(day("2026-10-12", "2026-10-14")))).toBe(true);
    expect(overlaps(a, tripWindow(day("2026-10-13", "2026-10-14")))).toBe(
      false,
    );
    const morning = tripWindow({
      rentalUnit: RentalUnit.HOUR,
      pickupDate: "2026-10-20",
      returnDate: "2026-10-20",
      pickupTime: "08:00",
      returnTime: "11:00",
    });
    const afternoon = tripWindow({
      rentalUnit: RentalUnit.HOUR,
      pickupDate: "2026-10-20",
      returnDate: "2026-10-20",
      pickupTime: "13:00",
      returnTime: "16:00",
    });
    expect(overlaps(morning, afternoon)).toBe(false);
  });

  it("keeps an overdue car blocked until it comes back", () => {
    const trip = day("2026-10-10", "2026-10-12");
    const now = Date.parse("2026-10-15T10:00:00Z");
    expect(heldWindow(trip, false, now)).toEqual(tripWindow(trip));
    expect(heldWindow(trip, true, now).end).toBeGreaterThan(now);
  });
});

describe("rental pricing", () => {
  it("adds the chauffeur per day and the second driver once, and ignores delivery the car doesn't offer", () => {
    expect(
      priceRental(car, RentalUnit.DAY, 3, {
        withDriver: true,
        additionalDriver: true,
        delivery: true,
      }),
    ).toEqual(
      expect.objectContaining({
        baseAmount: 180,
        driverFee: 75,
        additionalDriverFee: 15,
        deliveryFee: 0,
        delivery: false,
        totalAmount: 270,
      }),
    );
    expect(
      priceRental(car, RentalUnit.HOUR, 4, {
        withDriver: true,
        additionalDriver: false,
        delivery: false,
      }).totalAmount,
    ).toBe(68);
  });

  it("charges only the distance over the allowance", () => {
    expect(excessMileage(450, 100, 3, 0.5)).toEqual({ over: 150, charge: 75 });
    expect(excessMileage(250, 100, 3, 0.5)).toEqual({ over: 0, charge: 0 });
    expect(excessMileage(900, null, 3, 0.5)).toEqual({ over: 0, charge: 0 });
  });

  it("makes readable codes", () => {
    expect(rentalCode()).toMatch(/^[A-Z2-9]{6}$/);
  });
});
