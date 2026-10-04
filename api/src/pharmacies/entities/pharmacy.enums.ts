export enum PharmacyStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}
export enum PharmacyStaffRole {
  MANAGER = "manager",
  PHARMACIST = "pharmacist",
  EMPLOYEE = "employee",
}
export enum PharmacyOrderStatus {
  PENDING = "pending",
  UNDER_REVIEW = "under_review",
  ACCEPTED = "accepted",
  PREPARING = "preparing",
  READY_FOR_PICKUP = "ready_for_pickup",
  OUT_FOR_DELIVERY = "out_for_delivery",
  COMPLETED = "completed",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}
export enum FulfillmentMethod {
  PICKUP = "pickup",
  DELIVERY = "delivery",
}
export enum PrescriptionDecision {
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  CLARIFICATION_REQUESTED = "clarification_requested",
}
export enum PaymentStatus {
  PENDING = "pending",
  AUTHORIZED = "authorized",
  PAID = "paid",
  FAILED = "failed",
  REFUNDED = "refunded",
}
/** How a customer pays for a pharmacy order. */
export enum PharmacyPaymentMethod {
  CASH = "cash",
  MTN_MOMO = "mtn_momo",
  ORANGE_MONEY = "orange_money",
}
/**
 * Payment state of a pharmacy order (distinct from the unused legacy
 * PaymentStatus on pharmacy_payments).
 *
 * Cash is collected at pickup/delivery (pay_on_collection → paid when the
 * order completes). Mobile money follows the restaurant flow — the
 * customer sends the money and submits the transaction ID, staff confirm
 * they received it — except that a prescription order is only paid for
 * once a pharmacist has approved it (awaiting_payment), so nobody pays for
 * medicine they may not be allowed to receive.
 */
export enum PharmacyOrderPaymentStatus {
  PAY_ON_COLLECTION = "pay_on_collection",
  AWAITING_PAYMENT = "awaiting_payment",
  AWAITING_VERIFICATION = "awaiting_verification",
  PAID = "paid",
  FAILED = "failed",
  REFUND_DUE = "refund_due",
  REFUNDED = "refunded",
}
export const PHARMACY_PAYMENT_LABELS: Record<PharmacyPaymentMethod, string> = {
  [PharmacyPaymentMethod.CASH]: "cash",
  [PharmacyPaymentMethod.MTN_MOMO]: "MTN MoMo",
  [PharmacyPaymentMethod.ORANGE_MONEY]: "Orange Money",
};
