/**
 * What kind of thing a business is publishing. Deliberately one entity
 * with a type discriminator rather than five separate tables (Offer,
 * Announcement, Article, TravelTip, Experience) — they share the exact
 * same shape (title/body/images/optional link/optional validity window)
 * and the exact same moderation lifecycle; splitting them would just mean
 * five copies of the same CRUD/review-gate code with no real behavioral
 * difference between them today. `type` exists so the UI can group/label
 * things sensibly, not because the backend treats them differently.
 */
export enum BusinessContentType {
  OFFER = "offer",
  ANNOUNCEMENT = "announcement",
  ARTICLE = "article",
  TRAVEL_TIP = "travel_tip",
  EXPERIENCE = "experience",
}

/**
 * Same shape as BusinessReviewStatus (business.enums.ts) minus SUSPENDED —
 * a piece of content doesn't get "suspended" the way an entire listing
 * does, it just gets rejected (or removed by its own author). Draft →
 * submitted for review → approved (publicly visible) or rejected (with a
 * reason). Editing a REJECTED item resubmits it, exactly like
 * BusinessesService.updateMine does for a rejected Business listing.
 */
export enum BusinessContentStatus {
  DRAFT = "draft",
  SUBMITTED_FOR_REVIEW = "submitted_for_review",
  APPROVED = "approved",
  REJECTED = "rejected",
}
