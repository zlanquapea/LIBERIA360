export enum ClinicStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}

/** admin runs the clinic's page and staff; doctors write prescriptions. */
export enum ClinicStaffRole {
  ADMIN = "admin",
  DOCTOR = "doctor",
  FRONT_DESK = "front_desk",
}

export enum DoctorVerificationStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

/**
 * issued     written, the patient hasn't chosen a pharmacy yet
 * sent       sent to a pharmacy's counter queue (usually the clinic's own)
 * preparing  that pharmacy is packing it
 * ready      waiting at the counter
 * ordered    the patient ordered it through the app (see pharmacyOrderId)
 * dispensed  handed over; can never be used again
 * cancelled  withdrawn by the doctor
 *
 * "Expired" is derived from expiresAt, never stored.
 */
export enum EPrescriptionStatus {
  ISSUED = "issued",
  SENT = "sent",
  PREPARING = "preparing",
  READY = "ready",
  ORDERED = "ordered",
  DISPENSED = "dispensed",
  CANCELLED = "cancelled",
}

/** Statuses in which a prescription can still be filled. */
export const OPEN_PRESCRIPTION_STATUSES = [
  EPrescriptionStatus.ISSUED,
  EPrescriptionStatus.SENT,
  EPrescriptionStatus.PREPARING,
  EPrescriptionStatus.READY,
];

/** How long an e-prescription stays valid. */
export const PRESCRIPTION_VALID_DAYS = 30;

/**
 * requested  patient asked and paid; waiting for the doctor
 * active     the doctor confirmed payment and is consulting
 * completed  the doctor closed it with advice
 * declined   the doctor couldn't take it
 * cancelled  the patient withdrew before it started
 */
export enum ConsultationStatus {
  REQUESTED = "requested",
  ACTIVE = "active",
  COMPLETED = "completed",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}

export enum ConsultationPaymentMethod {
  MTN_MOMO = "mtn_momo",
  ORANGE_MONEY = "orange_money",
}

export enum ConsultationPaymentStatus {
  AWAITING_VERIFICATION = "awaiting_verification",
  PAID = "paid",
  FAILED = "failed",
  REFUND_DUE = "refund_due",
  REFUNDED = "refunded",
}

/** How the doctor closed the consultation. */
export enum ConsultationOutcome {
  ADVICE = "advice",
  PRESCRIPTION = "prescription",
  VISIT_CLINIC = "visit_clinic",
  EMERGENCY = "emergency",
}
