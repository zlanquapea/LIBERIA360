/** Phase 2 accounts (Tech Spec §3.2): email, Google, Apple, phone. Only
 * email/password is actually implemented here — Google/Apple require real
 * OAuth app registrations this environment can't create, and phone auth
 * needs an SMS provider. The enum is kept spec-complete so wiring in a real
 * provider later is a strategy addition, not a schema change. */
export enum AuthProvider {
  EMAIL = "email",
  GOOGLE = "google",
  APPLE = "apple",
  PHONE = "phone",
}

/** Who's asking (Business Plan §8.4) — the exact segments the platform's
 * own pitch names: "Liberians, the diaspora, expats, and international
 * visitors." Optional and editable after signup, not a gate on using the
 * app — it exists to make the B2B aggregate analytics product (and any
 * future on-platform personalization) segment by traveler type instead of
 * treating every visitor as the same audience. */
export enum TravelerType {
  DIASPORA = "diaspora",
  TOURIST = "tourist",
  EXPAT = "expat",
  BUSINESS_TRAVELER = "business_traveler",
  LOCAL_RESIDENT = "local_resident",
}
