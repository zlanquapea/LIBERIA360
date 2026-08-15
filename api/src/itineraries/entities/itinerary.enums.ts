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
