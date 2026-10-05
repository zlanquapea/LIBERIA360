/**
 * requested → confirmed → on_trip → returned, the same left-to-right line
 * as a food order. declined/cancelled/no_show end it early.
 */
export enum RentalStatus {
  REQUESTED = "requested",
  CONFIRMED = "confirmed",
  ON_TRIP = "on_trip",
  RETURNED = "returned",
  DECLINED = "declined",
  CANCELLED = "cancelled",
  NO_SHOW = "no_show",
}

/** Rentals that keep the car off the road for anyone else. A request
 * holds the car until the owner answers, so two renters can't be
 * promised the same days. */
export const HOLDING_RENTAL_STATUSES: readonly RentalStatus[] = [
  RentalStatus.REQUESTED,
  RentalStatus.CONFIRMED,
  RentalStatus.ON_TRIP,
];

export enum RentalUnit {
  DAY = "day",
  HOUR = "hour",
}

export enum RentalPaymentMethod {
  CASH_AT_PICKUP = "cash_at_pickup",
  MTN_MOMO = "mtn_momo",
  ORANGE_MONEY = "orange_money",
}

export enum RentalPaymentStatus {
  PAY_AT_PICKUP = "pay_at_pickup",
  AWAITING_VERIFICATION = "awaiting_verification",
  PAID = "paid",
  FAILED = "failed",
  REFUND_DUE = "refund_due",
  REFUNDED = "refunded",
}

export enum FuelLevel {
  EMPTY = "empty",
  QUARTER = "quarter",
  HALF = "half",
  THREE_QUARTERS = "three_quarters",
  FULL = "full",
}

export type ExtraCharge = { label: string; amount: number };
