import { RentalUnit } from "./entities/rental.enums";

/**
 * When a car is busy. Liberia runs on GMT with no daylight saving, so
 * times are read as UTC. A day rental takes the car for the whole of its
 * pickup and return days (the owner needs the return day to clean and
 * check it); an hourly rental only for its window on the day.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type Window = { start: number; end: number };

export type TripLike = {
  rentalUnit: RentalUnit | null;
  pickupDate: string;
  returnDate: string;
  pickupTime?: string | null;
  returnTime?: string | null;
};

const at = (date: string, time = "00:00") => Date.parse(`${date}T${time}:00Z`);

export function tripWindow(t: TripLike): Window {
  if (t.rentalUnit === RentalUnit.HOUR && t.pickupTime && t.returnTime)
    return {
      start: at(t.pickupDate, t.pickupTime),
      end: at(t.pickupDate, t.returnTime),
    };
  return { start: at(t.pickupDate), end: at(t.returnDate) + DAY - 1 };
}

/** A car still out past its return keeps blocking until it's back. */
export function heldWindow(
  t: TripLike,
  stillOut: boolean,
  now = Date.now(),
): Window {
  const w = tripWindow(t);
  return stillOut && now > w.end ? { start: w.start, end: now + DAY } : w;
}

export const overlaps = (a: Window, b: Window) =>
  a.start <= b.end && a.end >= b.start;

export function daysBetween(from: string, to: string) {
  return Math.round((at(to) - at(from)) / DAY);
}

/** Whole days (at least one) or whole hours, rounded up. */
export function rentalUnits(t: TripLike): number {
  if (t.rentalUnit === RentalUnit.HOUR) {
    const minutes =
      (at(t.pickupDate, t.returnTime!) - at(t.pickupDate, t.pickupTime!)) /
      60000;
    return minutes <= 0 ? 0 : Math.ceil(minutes / 60);
  }
  return Math.max(1, daysBetween(t.pickupDate, t.returnDate));
}

/** When the car is due back, as an instant. */
export function dueBack(t: TripLike): number {
  return at(
    t.rentalUnit === RentalUnit.HOUR ? t.pickupDate : t.returnDate,
    t.returnTime ?? "23:59",
  );
}

export const money = (n: number) => Math.round(n * 100) / 100;

type Priced = {
  pricePerDay: number;
  pricePerHour: number | null;
  withDriverAvailable: boolean;
  driverFeePerDay: number | null;
  driverFeePerHour: number | null;
  additionalDriverAllowed: boolean;
  additionalDriverFee: number | null;
  deliveryAvailable: boolean;
  deliveryFee: number | null;
};

/** The rental's price, line by line, from the listing as it is now. */
export function priceRental(
  car: Priced,
  unit: RentalUnit,
  units: number,
  opts: { withDriver: boolean; additionalDriver: boolean; delivery: boolean },
) {
  const hourly = unit === RentalUnit.HOUR;
  const unitPrice = hourly ? (car.pricePerHour ?? 0) : car.pricePerDay;
  const withDriver = opts.withDriver && car.withDriverAvailable;
  const additionalDriver = opts.additionalDriver && car.additionalDriverAllowed;
  const delivery = opts.delivery && car.deliveryAvailable;
  const baseAmount = money(unitPrice * units);
  const driverFee = withDriver
    ? money(
        units * ((hourly ? car.driverFeePerHour : car.driverFeePerDay) ?? 0),
      )
    : 0;
  const additionalDriverFee = additionalDriver
    ? money(car.additionalDriverFee ?? 0)
    : 0;
  const deliveryFee = delivery ? money(car.deliveryFee ?? 0) : 0;
  return {
    unitPrice,
    baseAmount,
    driverFee,
    additionalDriverFee,
    deliveryFee,
    withDriver,
    additionalDriver,
    delivery,
    totalAmount: money(
      baseAmount + driverFee + additionalDriverFee + deliveryFee,
    ),
  };
}

/** Distance over the allowance, and what it costs. */
export function excessMileage(
  driven: number,
  limitPerDay: number | null,
  days: number,
  feePerUnit: number | null,
) {
  if (!limitPerDay || driven <= 0) return { over: 0, charge: 0 };
  const over = Math.max(0, driven - limitPerDay * Math.max(1, days));
  return { over, charge: money(over * (feePerUnit ?? 0)) };
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function rentalCode(random: () => number = Math.random): string {
  return Array.from(
    { length: 6 },
    () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)],
  ).join("");
}

export const todayInLiberia = (now = new Date()) =>
  now.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  return new Date(at(date) + days * DAY).toISOString().slice(0, 10);
}
