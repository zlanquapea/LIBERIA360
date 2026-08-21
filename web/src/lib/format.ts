import type {
  BookingStatus,
  BudgetBand,
  BusinessContentStatus,
  BusinessContentType,
  BusinessReviewStatus,
  BusinessType,
  CreatorCategory,
  EventCategory,
  PlaceType,
  RecommendedVisitLength,
  TravelerType,
} from './types';

const TRAVELER_TYPE_LABELS: Record<TravelerType, string> = {
  diaspora: 'Liberian diaspora',
  tourist: 'Tourist / visitor',
  expat: 'Expat living in Liberia',
  business_traveler: 'Business traveler',
  local_resident: 'Local resident',
};

export function formatTravelerType(type: TravelerType): string {
  return TRAVELER_TYPE_LABELS[type] ?? type;
}

const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  attraction: 'Attraction',
  nature_site: 'Nature Site',
  hotel: 'Hotel & Lodge',
  restaurant: 'Restaurant',
  activity_provider: 'Tour & Activity',
};

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  hotel: 'Hotel',
  restaurant: 'Restaurant',
  tour_operator: 'Tour Operator / Guide',
  transport: 'Transportation',
  travel_agency: 'Travel Agency',
  beach_resort: 'Beach / Resort',
  attraction: 'Attraction',
  event_organizer: 'Event Organizer',
  shop: 'Shop',
  cultural_org: 'Cultural Organization',
  creative_business: 'Creative Business',
  other: 'Other',
};

export function formatBusinessType(type: BusinessType): string {
  return BUSINESS_TYPE_LABELS[type] ?? type;
}

const BUSINESS_REVIEW_STATUS_LABELS: Record<BusinessReviewStatus, string> = {
  draft: 'Draft',
  submitted_for_review: 'Submitted for review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export function formatBusinessReviewStatus(status: BusinessReviewStatus): string {
  return BUSINESS_REVIEW_STATUS_LABELS[status] ?? status;
}

const BUSINESS_CONTENT_TYPE_LABELS: Record<BusinessContentType, string> = {
  offer: 'Offer',
  announcement: 'Announcement',
  article: 'Article',
  travel_tip: 'Travel Tip',
  experience: 'Experience',
};

export function formatBusinessContentType(type: BusinessContentType): string {
  return BUSINESS_CONTENT_TYPE_LABELS[type] ?? type;
}

const BUSINESS_CONTENT_STATUS_LABELS: Record<BusinessContentStatus, string> = {
  draft: 'Draft',
  submitted_for_review: 'Submitted for review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function formatBusinessContentStatus(status: BusinessContentStatus): string {
  return BUSINESS_CONTENT_STATUS_LABELS[status] ?? status;
}

const VISIT_LENGTH_LABELS: Record<RecommendedVisitLength, string> = {
  day_trip: 'Day trip',
  overnight: 'Overnight',
  multi_day: 'Multi-day',
};

export function formatPlaceType(type: PlaceType): string {
  return PLACE_TYPE_LABELS[type] ?? type;
}

export function formatVisitLength(length: RecommendedVisitLength | null): string | null {
  return length ? VISIT_LENGTH_LABELS[length] : null;
}

export function formatDistance(km: number | null): string | null {
  if (km === null) return null;
  if (km === 0) return 'In Monrovia';
  return `${km} km from Monrovia`;
}

// The data model doesn't store a travel-time field, so this is a rough
// estimate (assumes ~35 km/h average, accounting for typical road
// conditions) — always labeled "estimated" rather than presented as fact.
export function estimateTravelTime(km: number | null): string | null {
  if (km === null || km === 0) return null;
  const minutes = Math.round((km / 35) * 60);
  if (minutes < 60) return `~${minutes} min drive (estimated)`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `~${hours}h${rem > 0 ? ` ${rem}m` : ''} drive (estimated)`;
}

// `amount` is typed `number | null`, but a field the backend omitted from
// a JSON response (rather than sending an explicit `null`) comes through
// as `undefined` at runtime — treat that the same as "not listed" rather
// than crashing on `undefined.toFixed`.
export function formatCost(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Not listed';
  if (amount === 0) return 'Free';
  return `$${amount.toFixed(2)}`;
}

export function formatRating(rating: number, reviewCount: number): string {
  if (reviewCount === 0) return 'Not yet rated';
  return `${rating.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? '' : 's'})`;
}

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  concert: 'Concert',
  festival: 'Festival',
  sports: 'Sports',
  nightlife: 'Nightlife',
  seasonal: 'Seasonal',
  other: 'Other',
};

export function formatEventCategory(category: EventCategory): string {
  return EVENT_CATEGORY_LABELS[category] ?? category;
}

const BUDGET_BAND_LABELS: Record<BudgetBand, string> = {
  budget: 'Budget (under $10/stop)',
  moderate: 'Moderate (under $50/stop)',
  premium: 'Premium (no limit)',
};

export function formatBudgetBand(band: BudgetBand): string {
  return BUDGET_BAND_LABELS[band] ?? band;
}

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Awaiting response',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export function formatBookingStatus(status: BookingStatus): string {
  return BOOKING_STATUS_LABELS[status] ?? status;
}

const CREATOR_CATEGORY_LABELS: Record<CreatorCategory, string> = {
  photographer: 'Photographer',
  videographer: 'Videographer',
  tour_guide: 'Tour Guide',
  tour_operator: 'Tour Operator',
  artist: 'Artist',
  chef: 'Chef & Food Creator',
  cultural: 'Cultural Creator',
  other: 'Creator',
};

export function formatCreatorCategory(category: CreatorCategory): string {
  return CREATOR_CATEGORY_LABELS[category] ?? category;
}

// Same "starting price" framing as an Activity/Offering card elsewhere —
// null means the creator hasn't listed one, not that it's free (unlike
// formatCost's 0-means-Free places/activities use).
export function formatPriceFrom(amount: number | null): string | null {
  if (amount === null) return null;
  return `From $${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export function formatEventDateRange(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (!endDate) return `${startLabel} · ${startTime}`;

  const end = new Date(endDate);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${startLabel} · ${startTime}–${endTime}`;
  }
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}
