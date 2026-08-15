/** Tech Spec §3.2 Events module: concerts, festivals, sports, nightlife,
 * seasonal events. A separate taxonomy from Place's interest categories
 * (beaches, culture, food, ...) — different axis, not reused. */
export enum EventCategory {
  CONCERT = "concert",
  FESTIVAL = "festival",
  SPORTS = "sports",
  NIGHTLIFE = "nightlife",
  SEASONAL = "seasonal",
  OTHER = "other",
}
