export enum GuideType {
  TOUR_GUIDE = "tour_guide",
  CULTURAL_HOST = "cultural_host",
  NATURE_GUIDE = "nature_guide",
  ADVENTURE_GUIDE = "adventure_guide",
  FOOD_HOST = "food_host",
}

export enum GuideVerificationStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected",
}

export enum ExperienceCategory {
  CITY = "city",
  CULTURE = "culture",
  NATURE = "nature",
  FOOD = "food",
}

export enum ExperienceGroupType {
  PRIVATE = "private",
  SMALL_GROUP = "small_group",
  GROUP = "group",
}

export enum ExperienceStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
}

export enum GuideBookingStatus {
  REQUESTED = "requested",
  CONFIRMED = "confirmed",
  DECLINED = "declined",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
}

export enum GuidePaymentStatus {
  UNPAID = "unpaid",
  PENDING = "pending",
  PAID = "paid",
  REFUNDED = "refunded",
}
