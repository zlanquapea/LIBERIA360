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
