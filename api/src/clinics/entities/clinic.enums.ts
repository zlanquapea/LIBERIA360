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
