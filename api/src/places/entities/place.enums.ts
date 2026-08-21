/** Place listings: attractions, nature sites, hotels, restaurants, activities (Tech Spec §3.1). */
export enum PlaceType {
  ATTRACTION = "attraction",
  NATURE_SITE = "nature_site",
  HOTEL = "hotel",
  RESTAURANT = "restaurant",
  ACTIVITY_PROVIDER = "activity_provider",
}

export enum RecommendedVisitLength {
  DAY_TRIP = "day_trip",
  OVERNIGHT = "overnight",
  MULTI_DAY = "multi_day",
}

/** Verification badges (Business Plan §5.1, Tech Spec §7). */
export enum VerificationStatus {
  UNVERIFIED = "unverified",
  VERIFIED = "verified",
  RECOMMENDED = "recommended",
  OFFICIAL = "official",
  ECO_CERTIFIED = "eco_certified",
  COMMUNITY_FAVORITE = "community_favorite",
}

/**
 * The publish/moderation lifecycle for a Place — same shape and reasoning
 * as BusinessReviewStatus (see that enum's doc comment), and orthogonal to
 * `VerificationStatus` for the same reason: this is "is this catalog entry
 * visible to the public at all," not "how much do we vouch for it."
 *
 * Places have two very different origins, so the two need different
 * starting points:
 * - Admin-authored (AdminContentService.createPlace, or any of the
 *   thousands of rows already in the catalog before this lifecycle
 *   existed) starts at APPROVED directly — an admin curating the catalog
 *   themselves doesn't need to review their own work, and a place that
 *   was already public yesterday can't suddenly disappear because this
 *   column got added. This is also the entity's column default, so every
 *   existing call site that creates a Place without setting reviewStatus
 *   explicitly keeps working unchanged.
 * - Self-submitted (PlacesService.submitPlace — a business owner listing
 *   a destination that isn't in the catalog yet) starts at
 *   SUBMITTED_FOR_REVIEW: hidden from the public catalog, search, and
 *   itinerary generation until an admin reviews and approves it.
 *
 * DRAFT/UNDER_REVIEW/REJECTED/SUSPENDED all carry the exact same meaning
 * as their Business counterparts — see BusinessReviewStatus.
 */
export enum PlaceReviewStatus {
  DRAFT = "draft",
  SUBMITTED_FOR_REVIEW = "submitted_for_review",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}
