/** What's being advertised — a self-serve marketplace ad slot is either
 * promoting a DIGITAL_PRODUCT (an app, an online course, a downloadable)
 * or a BUSINESS (a company/service that may or may not already have a
 * catalog listing here — this is a general-purpose ad unit, independent
 * of Place/Business/Creator, not a promotion of an existing listing). */
export enum AdvertisementType {
  DIGITAL_PRODUCT = "digital_product",
  BUSINESS = "business",
}

/**
 * The publish/moderation lifecycle for an Advertisement — same shape and
 * reasoning as PlaceReviewStatus/BusinessReviewStatus (see either's doc
 * comment for the full rationale): a self-submitted ad shouldn't be
 * publicly visible — let alone paid placement on the homepage — until an
 * admin has actually looked at it. SUSPENDED exists for the same reason
 * it does on a Business listing: pulling a live ad for a policy violation
 * is an explicit admin action, distinct from an owner-initiated REJECTED
 * resubmission.
 *
 * - DRAFT: safety-net default; every real creation path sets
 *   SUBMITTED_FOR_REVIEW directly (see AdvertisementsService.create — this
 *   mirrors PlacesService.submitPlace's single-step flow, not
 *   BusinessContent's draft-then-submit two-step, since there's no reason
 *   to make posting an ad two actions).
 * - SUBMITTED_FOR_REVIEW: awaiting an admin decision. Not shown anywhere
 *   public.
 * - APPROVED: live — eligible for the public "Sponsored" placements.
 * - REJECTED: not published; `rejectionReason` explains why. Editing a
 *   rejected ad resubmits it automatically (mirrors
 *   BusinessesService.updateMine).
 * - SUSPENDED: was live, pulled by an admin. An owner's own edits don't
 *   auto-resubmit a suspended ad.
 */
export enum AdvertisementReviewStatus {
  DRAFT = "draft",
  SUBMITTED_FOR_REVIEW = "submitted_for_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}
