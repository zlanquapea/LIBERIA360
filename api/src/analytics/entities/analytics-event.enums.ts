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
}
