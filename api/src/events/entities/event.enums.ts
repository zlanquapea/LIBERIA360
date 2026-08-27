/** Tech Spec §3.2 Events module: concerts, festivals, sports, nightlife,
 * seasonal events. A separate taxonomy from Place's interest categories
 * (beaches, culture, food, ...) — different axis, not reused. */
export enum EventCategory {
  CONCERT = "concert",
  FESTIVAL = "festival",
  SPORTS = "sports",
  NIGHTLIFE = "nightlife",
  SEASONAL = "seasonal",
  OTHER = "other",
}

/** The publish/moderation lifecycle for a self-submitted event — simpler
 * than Place/Advertisement's five-state machine (no DRAFT/UNDER_REVIEW
 * step; a single POST /events is the whole submission) but the same
 * "not public until an admin decides" gate. Only reachable via the public
 * listing when APPROVED (see EventsService.findAll) — a PENDING or
 * REJECTED event stays invisible there and in the admin moderation
 * queue's "Pending events" section until acted on. Admin/super-admin-
 * created events (EventsService.assertCanPostEvents already restricts who
 * can post at all) skip straight to APPROVED — an admin reviewing their
 * own submission would be reviewing nothing. */
export enum EventReviewStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}
