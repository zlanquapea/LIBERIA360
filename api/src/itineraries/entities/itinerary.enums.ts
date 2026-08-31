/** Tech Spec §4.3 doesn't pin exact budget bands — a simple 3-tier scale is
 * enough to shape which places the generator picks (§5 Itinerary.budget_band). */
export enum BudgetBand {
  BUDGET = "budget",
  MODERATE = "moderate",
  PREMIUM = "premium",
}

/** "Build My Liberia Trip" (§4.3) vs "Weekend Explorer" (§3.2) — same
 * generation engine, different intake and defaults. Tracked so the
 * frontend can label saved itineraries appropriately. */
export enum ItineraryKind {
  TRIP = "trip",
  WEEKEND = "weekend",
}

/** Social travel experience (Aug 2026 product spec): who can discover and
 * join a trip. PRIVATE is the default — a trip only becomes reachable by
 * anyone but the creator's invitees once the creator deliberately flips
 * it, never by omission. Public doesn't mean "anyone auto-joins" — see
 * TripJoinRequestStatus below for the approval gate that keeps applying
 * even once a trip is public. */
export enum TripVisibility {
  PRIVATE = "private",
  PUBLIC = "public",
}

/** Best-effort lifecycle label, computed from startDate/endDate/
 * cancelledAt rather than stored — a trip's status should never be able
 * to drift out of sync with its own dates by staying frozen in a stale
 * stored value. See ItinerariesService.computeTripStatus. */
export enum TripStatus {
  UPCOMING = "upcoming",
  ONGOING = "ongoing",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}
