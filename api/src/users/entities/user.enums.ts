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
