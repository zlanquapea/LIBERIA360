/** Place listings: attractions, nature sites, hotels, restaurants, activities (Tech Spec §3.1). */
export enum PlaceType {
  ATTRACTION = "attraction",
  NATURE_SITE = "nature_site",
  HOTEL = "hotel",
  RESTAURANT = "restaurant",
  ACTIVITY_PROVIDER = "activity_provider",
}

export enum RecommendedVisitLength {
  DAY_TRIP = "day_trip",
  OVERNIGHT = "overnight",
  MULTI_DAY = "multi_day",
}

/** Verification badges (Business Plan §5.1, Tech Spec §7). */
export enum VerificationStatus {
  UNVERIFIED = "unverified",
  VERIFIED = "verified",
  RECOMMENDED = "recommended",
  OFFICIAL = "official",
  ECO_CERTIFIED = "eco_certified",
  COMMUNITY_FAVORITE = "community_favorite",
}
