import type { BusinessType, PlaceType, RecommendedVisitLength } from './types';

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
  tour_operator: 'Tour Operator',
  transport: 'Transport',
};

export function formatBusinessType(type: BusinessType): string {
  return BUSINESS_TYPE_LABELS[type] ?? type;
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

export function formatCost(amount: number | null): string {
  if (amount === null) return 'Not listed';
  if (amount === 0) return 'Free';
  return `$${amount.toFixed(2)}`;
}

export function formatRating(rating: number, reviewCount: number): string {
  if (reviewCount === 0) return 'Not yet rated';
  return `${rating.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? '' : 's'})`;
}
