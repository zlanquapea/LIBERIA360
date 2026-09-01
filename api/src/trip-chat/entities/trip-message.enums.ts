// A user-authored message vs. an automatic one the service posts itself
// (someone joined/left, the trip was renamed or cancelled — Section 9 of
// the Aug 2026 social-trip spec's "system messages for joins/leaves/
// updates"). Declared before the entity that references it in a
// `@Column({ enum: ... })`, same convention as TripVisibility/TripStatus.
export enum TripMessageType {
  USER = "user",
  SYSTEM = "system",
}
