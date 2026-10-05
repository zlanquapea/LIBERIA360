import { BusinessType } from "../../businesses/entities/business.enums";

/** Businesses that sell rooms by the night: hotels, guesthouses, lodges and
 * beach resorts. Guesthouses and lodges register as HOTEL. */
export const STAY_BUSINESS_TYPES: readonly BusinessType[] = [
  BusinessType.HOTEL,
  BusinessType.BEACH_RESORT,
];

export function businessHasRooms(type: BusinessType): boolean {
  return STAY_BUSINESS_TYPES.includes(type);
}

/**
 * requested → confirmed → checked_in → checked_out, the same left-to-right
 * line a food order follows. declined/cancelled/no_show end it early.
 */
export enum ReservationStatus {
  REQUESTED = "requested",
  CONFIRMED = "confirmed",
  CHECKED_IN = "checked_in",
  CHECKED_OUT = "checked_out",
  DECLINED = "declined",
  CANCELLED = "cancelled",
  NO_SHOW = "no_show",
}

/** Reservations that take a room out of what's left to sell. A request
 * holds its rooms until the property confirms or declines it, so two
 * guests can never be promised the last room. */
export const HOLDING_STATUSES: readonly ReservationStatus[] = [
  ReservationStatus.REQUESTED,
  ReservationStatus.CONFIRMED,
  ReservationStatus.CHECKED_IN,
];

export enum ReservationSource {
  ONLINE = "online",
  WALK_IN = "walk_in",
}

export enum StayPaymentMethod {
  PAY_AT_PROPERTY = "pay_at_property",
  MTN_MOMO = "mtn_momo",
  ORANGE_MONEY = "orange_money",
}

export enum StayPaymentStatus {
  PAY_AT_PROPERTY = "pay_at_property",
  AWAITING_VERIFICATION = "awaiting_verification",
  PAID = "paid",
  FAILED = "failed",
  REFUND_DUE = "refund_due",
  REFUNDED = "refunded",
}

export const STAY_CURRENCIES = ["USD", "LRD"] as const;
export type StayCurrency = (typeof STAY_CURRENCIES)[number];
