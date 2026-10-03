/** Business analytics dashboard (Tech Spec §3.3 — "views, saves, contact
 * clicks, conversion") and the B2B aggregate tourism analytics product
 * (§8.4) are both built on this one event log. BOOKING_REQUEST is the
 * "conversion" signal — fired by the frontend right after a booking
 * request succeeds. */
export enum AnalyticsEventType {
  VIEW = "view",
  SAVE = "save",
  CONTACT_CLICK = "contact_click",
  BOOKING_REQUEST = "booking_request",
  // Product-usage signals. ADD_TO_TRIP targets a place like SAVE does.
  // SEARCH and TRIP_CREATE are platform-wide and carry no target.
  ADD_TO_TRIP = "add_to_trip",
  SEARCH = "search",
  TRIP_CREATE = "trip_create",
}

/** Event types recorded without a place/creator/ad/event target. */
export const PLATFORM_EVENT_TYPES: readonly AnalyticsEventType[] = [
  AnalyticsEventType.SEARCH,
  AnalyticsEventType.TRIP_CREATE,
];
