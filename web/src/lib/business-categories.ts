import type { BusinessType, PlaceType } from './types';

// Shared between the directory filter and the claim/edit forms — same
// pattern as CREATOR_CATEGORIES.
export const BUSINESS_TYPES: BusinessType[] = [
  'hotel',
  'restaurant',
  'tour_operator',
  'transport',
  'travel_agency',
  'beach_resort',
  'attraction',
  'event_organizer',
  'shop',
  'cultural_org',
  'creative_business',
  'car_rental',
  'bar',
  'other',
];

// Loose mapping from the catalog's PlaceType to a BusinessType — just a
// sensible default for a type dropdown, not a strict correspondence (an
// attraction's on-site cafe is still a "restaurant" business, for instance).
const SUGGESTED_BUSINESS_TYPE: Record<PlaceType, BusinessType> = {
  hotel: 'hotel',
  restaurant: 'restaurant',
  activity_provider: 'tour_operator',
  attraction: 'tour_operator',
  nature_site: 'tour_operator',
};

/** Default business type when listing a business on a place. There is no
 * "bar" place type, so bars and lounges are added under the Nightlife
 * category instead; those default to the bar business type so the owner
 * gets a drinks-first menu without having to spot and change the default. */
export function suggestBusinessType(place: { type: PlaceType; category?: { slug: string } | null }): BusinessType {
  if (place.category?.slug === 'nightlife') return 'bar';
  return SUGGESTED_BUSINESS_TYPE[place.type];
}
