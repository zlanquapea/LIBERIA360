export enum ReportTargetType {
  REVIEW = "review",
  EVENT = "event",
  BUSINESS = "business",
  // "Something on this place page is wrong" — hours, prices, contacts,
  // location. Lands in the same moderation queue as other reports.
  PLACE = "place",
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
  INCORRECT_INFO = "incorrect_info",
  OTHER = "other",
}
