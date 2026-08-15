/** Request-to-book workflow (Phase 3, per product decision: no real payment
 * moves through the app yet — a business confirms or declines a request,
 * the same shape hotel/tour/restaurant/transport bookings all share via
 * the linked Business.type). */
export enum BookingStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}

/** Payment capture is deferred — these fields exist so the schema doesn't
 * need a breaking migration once real payment integration lands, not
 * because anything here calls a payment API yet. MTN Mobile Money was
 * chosen as the target provider for the Liberian market; PaymentStatus
 * stays UNPAID for every booking until a real MoMo merchant integration
 * is wired in as a follow-up. */
export enum PaymentProvider {
  MTN_MOMO = "mtn_momo",
}

export enum PaymentStatus {
  UNPAID = "unpaid",
  PENDING = "pending",
  PAID = "paid",
  REFUNDED = "refunded",
}
