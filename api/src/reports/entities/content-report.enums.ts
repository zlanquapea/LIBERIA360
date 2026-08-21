export enum ReportTargetType {
  REVIEW = "review",
  EVENT = "event",
  BUSINESS = "business",
}

export enum ReportReason {
  SPAM = "spam",
  INAPPROPRIATE = "inappropriate",
  FAKE = "fake",
  // Business-specific reasons (Business Profiles spec's tourist-facing
  // reporting categories) — also legal on a review/event report; nothing
  // stops a reviewer from picking FRAUDULENT for a scammy review, and
  // that's fine, not worth a second enum just to keep them apart.
  FRAUDULENT = "fraudulent",
  MISLEADING_OFFER = "misleading_offer",
  COPYRIGHT = "copyright",
  OTHER = "other",
}
