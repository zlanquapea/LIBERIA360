/**
 * Coarse creator type, used for profile display and directory filtering.
 * Deliberately separate from `Creator.specialties` (freeform tags) — this
 * is the fixed, small vocabulary a filter UI can actually build controls
 * against; specialties stays freeform for the finer-grained "what kind of
 * photographer" detail that varies too much to enumerate.
 */
export enum CreatorCategory {
  PHOTOGRAPHER = "photographer",
  VIDEOGRAPHER = "videographer",
  TOUR_GUIDE = "tour_guide",
  TOUR_OPERATOR = "tour_operator",
  ARTIST = "artist",
  CHEF = "chef",
  CULTURAL = "cultural",
  OTHER = "other",
}

/**
 * Creator trust badge. Deliberately just two states, unlike Place/Business's
 * six-tier VerificationStatus (place.enums.ts) — those layer in editorial
 * designations ("recommended", "eco_certified") that describe a place or
 * listing, not a person offering services. Admin-set only, via the same
 * pattern as AdminService.setPlaceVerification/setBusinessVerification
 * (status + verifiedByUserId + verifiedAt, audit-logged) — replaces the
 * old `Creator.verified` boolean, which no endpoint ever actually set.
 */
export enum CreatorVerificationStatus {
  UNVERIFIED = "unverified",
  VERIFIED = "verified",
}

/**
 * One row in a creator's portfolio gallery. Video is link/embed-only by
 * design (YouTube/Vimeo/Instagram, same idea as the existing `contentLinks`
 * field) — no self-hosted video upload, to avoid the storage and
 * transcoding cost of hosting video for what is, for now, an MVP gallery.
 */
export enum CreatorPortfolioItemType {
  IMAGE = "image",
  VIDEO = "video",
}
