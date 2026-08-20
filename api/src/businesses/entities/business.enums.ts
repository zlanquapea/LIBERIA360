/** Tech Spec §5 Business.type, expanded for the Business Profiles pass —
 * the original 4 values only covered the businesses that happened to claim
 * listings first, not the actual range of tourism-economy operators the
 * catalog needs to represent (guides, agencies, resorts, attractions,
 * event organizers, retail, cultural/creative orgs). `OTHER` is a
 * deliberate escape hatch so a legitimate business never has to misclassify
 * itself while waiting on a future enum value. */
export enum BusinessType {
  HOTEL = "hotel",
  RESTAURANT = "restaurant",
  TOUR_OPERATOR = "tour_operator",
  TRANSPORT = "transport",
  TRAVEL_AGENCY = "travel_agency",
  BEACH_RESORT = "beach_resort",
  ATTRACTION = "attraction",
  EVENT_ORGANIZER = "event_organizer",
  SHOP = "shop",
  CULTURAL_ORG = "cultural_org",
  CREATIVE_BUSINESS = "creative_business",
  OTHER = "other",
}

/** Business Plan §8.1 freemium tiers. Phase 2 just needs the field to exist
 * — actual billing/upgrade flow is Phase 3 (marketplace/payments). */
export enum SubscriptionTier {
  FREE = "free",
  PREMIUM = "premium",
}

/**
 * The publish/moderation lifecycle for a Business listing — orthogonal to
 * `VerificationStatus` (the trust *badge* — verified/recommended/official/
 * etc., which only ever applies to a listing that's already live). This is
 * "is this listing visible to the public at all," not "how much do we
 * vouch for it":
 *
 * - DRAFT: not submitted for review by anyone yet. The DB column default —
 *   a listing only ever lands here if some code path saved a Business
 *   without explicitly setting a status, which shouldn't normally happen
 *   (self-claim sets SUBMITTED_FOR_REVIEW, admin-seeding sets APPROVED),
 *   so this is a safety net that fails hidden, not a status any UI flow
 *   deliberately puts a listing into.
 * - SUBMITTED_FOR_REVIEW: a business owner just claimed a listing. Hidden
 *   from public discovery/profile until an admin acts on it.
 * - UNDER_REVIEW: an admin has picked it up but isn't ready to approve or
 *   reject yet — also doubles as "changes requested" (paired with
 *   `rejectionReason` used as reviewer guidance rather than a rejection).
 * - APPROVED: live and publicly visible. Admin-seeded businesses
 *   (Business.createBusiness, admin CRUD) start here directly — an admin
 *   authoring a listing themselves doesn't need to review their own work.
 * - REJECTED: not published; `rejectionReason` explains why. An owner
 *   editing a rejected listing resubmits it (back to SUBMITTED_FOR_REVIEW)
 *   automatically — see BusinessesService.updateMine.
 * - SUSPENDED: was live, pulled for a policy violation. Unlike REJECTED,
 *   an owner's own edits don't auto-resubmit a suspended listing — lifting
 *   a suspension is an explicit admin action.
 */
export enum BusinessReviewStatus {
  DRAFT = "draft",
  SUBMITTED_FOR_REVIEW = "submitted_for_review",
  UNDER_REVIEW = "under_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  SUSPENDED = "suspended",
}
