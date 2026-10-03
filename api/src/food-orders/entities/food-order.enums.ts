/** Order lifecycle. The restaurant confirms (for mobile money, that also
 * means they've found the payment), then moves the order along until it's
 * completed. Declined and cancelled are terminal.
 *
 *   pending → confirmed → preparing → out_for_delivery → completed  (delivery)
 *                                   → ready            → completed  (pickup)
 */
export enum FoodOrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PREPARING = "preparing",
  READY = "ready",
  OUT_FOR_DELIVERY = "out_for_delivery",
  COMPLETED = "completed",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}

export enum FoodFulfillment {
  PICKUP = "pickup",
  DELIVERY = "delivery",
}

export enum FoodPaymentMethod {
  // Pay in cash on delivery / at pickup.
  CASH = "cash",
  MTN_MOMO = "mtn_momo",
  ORANGE_MONEY = "orange_money",
}

export const MOBILE_MONEY_METHODS: readonly FoodPaymentMethod[] = [
  FoodPaymentMethod.MTN_MOMO,
  FoodPaymentMethod.ORANGE_MONEY,
];

/** Mobile money follows the event-ticket flow: the customer pays first and
 * submits a transaction ID, the restaurant verifies it. Cash is collected
 * when the food is handed over. */
export enum FoodPaymentStatus {
  // Cash, not collected yet.
  PAY_ON_DELIVERY = "pay_on_delivery",
  // Mobile money transaction ID submitted, restaurant hasn't checked it.
  AWAITING_VERIFICATION = "awaiting_verification",
  PAID = "paid",
  // Restaurant couldn't find the mobile money payment.
  FAILED = "failed",
  // Paid by mobile money, then declined or cancelled: money is owed back.
  REFUND_DUE = "refund_due",
  REFUNDED = "refunded",
}
