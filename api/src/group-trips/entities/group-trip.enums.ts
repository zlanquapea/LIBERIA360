/** Where a traveller's booking on an organised trip stands. Pending and
 * confirmed bookings hold their spots; a waitlisted one holds nothing
 * until the organiser offers it a spot. */
export enum TripBookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  WAITLISTED = "waitlisted",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}

export const HOLDING_TRIP_BOOKING_STATUSES = [
  TripBookingStatus.PENDING,
  TripBookingStatus.CONFIRMED,
];

export const ACTIVE_TRIP_BOOKING_STATUSES = [
  ...HOLDING_TRIP_BOOKING_STATUSES,
  TripBookingStatus.WAITLISTED,
];

/** The three ways people pay for things in Liberia. */
export enum TripPaymentMethod {
  CASH = "cash",
  MTN_MOMO = "mtn_momo",
  ORANGE_MONEY = "orange_money",
}

/** Money on a booking as a whole. A free trip never owes anything. */
export enum TripBookingPaymentStatus {
  FREE = "free",
  UNPAID = "unpaid",
  PART_PAID = "part_paid",
  PAID = "paid",
  REFUND_DUE = "refund_due",
  REFUNDED = "refunded",
}

/** One payment toward a booking: a mobile money transfer waiting for the
 * organiser to find it, or cash the organiser took in hand. */
export enum TripPaymentRecordStatus {
  AWAITING_VERIFICATION = "awaiting_verification",
  RECEIVED = "received",
  REJECTED = "rejected",
}

/** Pay everything now, or hold the spot with the organiser's deposit
 * and pay the rest before the balance date. */
export enum TripPaymentPlan {
  FULL = "full",
  DEPOSIT = "deposit",
}

export interface TripOrganiser {
  name: string;
  logo: string | null;
}

export interface TripTraveller {
  name: string;
  boarded: boolean;
}
