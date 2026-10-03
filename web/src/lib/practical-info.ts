import type { Place, PlaceAmenity, PracticalInfoSource } from './types';

export const AMENITY_LABELS: Record<PlaceAmenity, string> = {
  parking: 'Parking',
  restrooms: 'Restrooms',
  drinking_water: 'Drinking water',
  food_on_site: 'Food on site',
  wifi: 'Wi-Fi',
  power_backup: 'Generator / power backup',
  card_payments: 'Card payments',
  mobile_money: 'Mobile money',
  guided_tours: 'Guided tours',
  lifeguard: 'Lifeguard',
  changing_rooms: 'Changing rooms',
  shade_seating: 'Shade & seating',
  family_friendly: 'Family friendly',
  pet_friendly: 'Pet friendly',
};

export const PRACTICAL_SOURCE_LABELS: Record<PracticalInfoSource, string> = {
  liberia360_team: 'Checked by the LIBERIA360 team',
  business_owner: 'Provided by the business',
  community: 'Shared by the community',
  official_source: 'From an official source',
};

/** "Checked by the LIBERIA360 team · Last checked Mar 4, 2026", or null
 * when nothing is recorded — callers then say so rather than implying the
 * details were ever confirmed. */
export function describeProvenance(
  place: Pick<Place, 'practicalInfoSource' | 'practicalInfoCheckedAt'>,
  locale = 'en-US',
): { source: string | null; checked: string | null } {
  return {
    source: place.practicalInfoSource ? PRACTICAL_SOURCE_LABELS[place.practicalInfoSource] : null,
    checked: place.practicalInfoCheckedAt
      ? new Date(place.practicalInfoCheckedAt).toLocaleDateString(locale, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null,
  };
}

/** Days since the practical details were last confirmed, or null. */
export function daysSinceChecked(
  place: Pick<Place, 'practicalInfoCheckedAt'>,
  now: Date = new Date(),
): number | null {
  if (!place.practicalInfoCheckedAt) return null;
  return Math.floor((now.getTime() - new Date(place.practicalInfoCheckedAt).getTime()) / 86_400_000);
}

// Details older than this get a gentle "may be out of date" note.
export const STALE_AFTER_DAYS = 180;
