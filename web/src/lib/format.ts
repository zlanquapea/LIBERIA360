import type {
  AdvertisementReviewStatus,
  AdvertisementType,
  BookingStatus,
  BudgetBand,
  BusinessContentStatus,
  BusinessContentType,
  BusinessReviewStatus,
  BusinessType,
  CarCategory,
  CarFuelType,
  CarListingReviewStatus,
  CarTransmission,
  CreatorCategory,
  EventCategory,
  EventReviewStatus,
  FoodOrderStatus,
  PlaceReviewStatus,
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
  car_rental: 'Car Rental',
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

const PLACE_REVIEW_STATUS_LABELS: Record<PlaceReviewStatus, string> = {
  draft: 'Draft',
  submitted_for_review: 'Submitted for review',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export function formatPlaceReviewStatus(status: PlaceReviewStatus): string {
  return PLACE_REVIEW_STATUS_LABELS[status] ?? status;
}

const ADVERTISEMENT_TYPE_LABELS: Record<AdvertisementType, string> = {
  digital_product: 'Digital product',
  business: 'Business',
};

export function formatAdvertisementType(type: AdvertisementType): string {
  return ADVERTISEMENT_TYPE_LABELS[type] ?? type;
}

// No under_review value for an ad (see AdvertisementReviewStatus's doc
// comment — unlike Place/Business, it's not a status any code path sets).
const ADVERTISEMENT_REVIEW_STATUS_LABELS: Record<AdvertisementReviewStatus, string> = {
  draft: 'Draft',
  submitted_for_review: 'Submitted for review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export function formatAdvertisementReviewStatus(status: AdvertisementReviewStatus): string {
  return ADVERTISEMENT_REVIEW_STATUS_LABELS[status] ?? status;
}

const CAR_CATEGORY_LABELS: Record<CarCategory, string> = {
  economy: 'Economy',
  compact: 'Compact',
  sedan: 'Sedan',
  suv: 'SUV',
  van: 'Van',
  minibus: 'Minibus',
  pickup: 'Pickup',
  luxury: 'Luxury',
};

export function formatCarCategory(category: CarCategory): string {
  return CAR_CATEGORY_LABELS[category] ?? category;
}

const CAR_TRANSMISSION_LABELS: Record<CarTransmission, string> = {
  automatic: 'Automatic',
  manual: 'Manual',
};

export function formatCarTransmission(transmission: CarTransmission): string {
  return CAR_TRANSMISSION_LABELS[transmission] ?? transmission;
}

const CAR_FUEL_TYPE_LABELS: Record<CarFuelType, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  hybrid: 'Hybrid',
  electric: 'Electric',
};

export function formatCarFuelType(fuelType: CarFuelType): string {
  return CAR_FUEL_TYPE_LABELS[fuelType] ?? fuelType;
}

// Same shape as AdvertisementReviewStatus — no under_review value.
const CAR_LISTING_REVIEW_STATUS_LABELS: Record<CarListingReviewStatus, string> = {
  draft: 'Draft',
  submitted_for_review: 'Submitted for review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export function formatCarListingReviewStatus(status: CarListingReviewStatus): string {
  return CAR_LISTING_REVIEW_STATUS_LABELS[status] ?? status;
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

const EVENT_REVIEW_STATUS_LABELS: Record<EventReviewStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function formatEventReviewStatus(status: EventReviewStatus): string {
  return EVENT_REVIEW_STATUS_LABELS[status] ?? status;
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

const FOOD_ORDER_STATUS_LABELS: Record<FoodOrderStatus, string> = {
  pending: 'Awaiting response',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

// Shared between the buyer's My Orders list and the restaurant owner's
// Incoming Orders queue, so the two sides of the same order always agree
// on what a status means.
export function formatFoodOrderStatus(status: FoodOrderStatus): string {
  return FOOD_ORDER_STATUS_LABELS[status] ?? status;
}

// Shared between the compact booking row and its detail view — kept as one
// helper so the two don't drift apart on date formatting.
export function formatBookingDateRange(requestedDate: string, requestedEndDate: string | null): string {
  const startLabel = new Date(requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (!requestedEndDate) return startLabel;
  const endLabel = new Date(requestedEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

function formatTimeLabel(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

// Same "when" as formatBookingDateRange, but for an hour-mode car-rental
// booking (Booking.rentalUnit — see the backend entity's doc comment)
// shows the single day plus the HH:mm–HH:mm time span instead of a date
// range. Falls back to formatBookingDateRange for every other booking
// (rentalUnit null/'day', or no time fields set).
export function formatBookingWhen(
  requestedDate: string,
  requestedEndDate: string | null,
  rentalUnit: 'day' | 'hour' | null,
  requestedStartTime: string | null,
  requestedEndTime: string | null,
): string {
  if (rentalUnit === 'hour' && requestedStartTime && requestedEndTime) {
    const dateLabel = new Date(requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${dateLabel}, ${formatTimeLabel(requestedStartTime)}–${formatTimeLabel(requestedEndTime)}`;
  }
  return formatBookingDateRange(requestedDate, requestedEndDate);
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

// A "Happening now" status beats a plain date for an event already in
// progress — the one thing worth leading with while it's actually
// possible to go. Same "in progress" shape as PlaceKeyFacts' open-now
// check: now falls inside [start, end], with end defaulting to a
// generous same-day cutoff (6 hours after start) when the organizer
// never set one, since most listed events run a few hours, not
// indefinitely.
export function isEventHappeningNow(startDate: string, endDate: string | null): boolean {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = endDate ? new Date(endDate).getTime() : start + 6 * 60 * 60 * 1000;
  return now >= start && now <= end;
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

// `<input type="datetime-local">` needs "YYYY-MM-DDTHH:mm" in the viewer's
// local time (no timezone, no seconds) — pre-filling an edit form from an
// ISO string means formatting via the local getters below, not slicing
// toISOString() (that's UTC and would shift the displayed time).
export function toDatetimeLocalInput(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

// "3h ago" style timestamps for the notification bell/feed — full
// toLocaleString() (as the audit log uses) is precise but noisy for a
// glanceable list someone scans repeatedly; this trades precision for
// scannability, same tradeoff most notification UIs make.
export function formatRelativeTime(isoString: string): string {
  const seconds = Math.round((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  for (const [unit, secondsInUnit] of RELATIVE_TIME_UNITS) {
    const value = Math.floor(seconds / secondsInUnit);
    if (value >= 1) {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-value, unit);
    }
  }
  return 'just now';
}
