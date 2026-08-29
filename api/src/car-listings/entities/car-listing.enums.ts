/** The body style a renter actually searches/filters by — not the same
 * axis as BusinessType (which classifies the *operator*, not the
 * vehicle). MINIBUS is separate from VAN since a group/tour booking
 * (this catalog's core use case, per Trip Planner) cares about that
 * distinction more than a typical rental fleet would. */
export enum CarCategory {
  ECONOMY = "economy",
  COMPACT = "compact",
  SEDAN = "sedan",
  SUV = "suv",
  VAN = "van",
  MINIBUS = "minibus",
  PICKUP = "pickup",
  LUXURY = "luxury",
}

export enum CarTransmission {
  AUTOMATIC = "automatic",
  MANUAL = "manual",
}

export enum CarFuelType {
  PETROL = "petrol",
  DIESEL = "diesel",
  HYBRID = "hybrid",
  ELECTRIC = "electric",
}

/**
 * The publish/moderation lifecycle for a CarListing — same shape and
 * reasoning as AdvertisementReviewStatus (see its doc comment for the
 * full rationale): a self-listed vehicle isn't just display copy the way
 * a CreatorOffering card is, it's a real physical asset a stranger is
 * about to hand money over for and get into, so it goes through the same
 * human-review gate as a Business claim or an Advertisement rather than
 * going live the moment its owner saves it.
 *
 * - DRAFT: safety-net default; CarListingsService.create sets
 *   SUBMITTED_FOR_REVIEW directly, same single-step reasoning as
 *   AdvertisementsService.create.
 * - SUBMITTED_FOR_REVIEW: awaiting an admin decision. Not shown anywhere
 *   public, not bookable.
 * - APPROVED: live and bookable (subject to `isActive` — see the entity).
 * - REJECTED: not published; `rejectionReason` explains why. Editing a
 *   rejected listing resubmits it automatically (mirrors
 *   AdvertisementsService.update).
 * - SUSPENDED: was live, pulled by an admin for a policy/safety issue. An
 *   owner's own edits don't auto-resubmit a suspended listing.
 */
export enum CarListingReviewStatus {
  DRAFT = "draft",
  SUBMITTED_FOR_REVIEW = "submitted_for_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}
