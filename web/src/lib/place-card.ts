import type { Place } from './types';

/** "Sinkor, Montserrado": trimmed (catalog entries sometimes carry stray
 * spaces, which rendered as "Monrovia , Montserrado"), and without the
 * county repeated when the city field is just the county name. */
export function placeLocation(place: Pick<Place, 'city'> & { county: { name: string } }): string {
  const city = (place.city ?? '').trim().replace(/\s+/g, ' ');
  const county = place.county.name.trim();
  if (!city || city.toLowerCase() === county.toLowerCase()) return county;
  return `${city}, ${county}`;
}

/** The first part of a category name, for a chip on a narrow card:
 * "Waterfalls & Nature" → "Waterfalls", "Salons/Barbers Shops" → "Salons". */
export function shortCategory(name: string): string {
  const first = name.split(/\s*[&/,]\s*/)[0]?.trim();
  return first || name;
}

/** Whether a 2-column (phone) / 4-column (desktop) grid of `count` cards
 * should lead with one large feature tile without leaving a gap: the
 * feature fills 2 cells on phones and 4 on desktop. */
export function leadsWithFeature(count: number): boolean {
  return count >= 5 && (count - 1) % 4 === 0;
}
