/** Tech Spec §5 Business.type. */
export enum BusinessType {
  HOTEL = "hotel",
  RESTAURANT = "restaurant",
  TOUR_OPERATOR = "tour_operator",
  TRANSPORT = "transport",
}

/** Business Plan §8.1 freemium tiers. Phase 2 just needs the field to exist
 * — actual billing/upgrade flow is Phase 3 (marketplace/payments). */
export enum SubscriptionTier {
  FREE = "free",
  PREMIUM = "premium",
}
