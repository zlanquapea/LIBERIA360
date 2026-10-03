/** A guide is visible to the public only once an admin has approved it.
 * Editing a published guide's content sends it back for review. */
export enum CreatorGuideStatus {
  DRAFT = "draft",
  PENDING_REVIEW = "pending_review",
  PUBLISHED = "published",
  REJECTED = "rejected",
}
