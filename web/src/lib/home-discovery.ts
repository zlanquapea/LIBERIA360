import type { Category, Place } from './types';

// Homepage discovery helpers. Kept pure so the page's choices (which
// weekend, which collections, no repeated listings) are tested directly.

/** The coming (or current) weekend: Friday 00:00 to Sunday 23:59:59.
 * Liberia keeps GMT all year, so UTC is local time. From Friday on, the
 * window starts now rather than at Friday midnight. */
export function weekendWindow(now: Date = new Date()): { from: Date; to: Date; isNow: boolean } {
  const day = now.getUTCDay(); // 0 Sun … 6 Sat
  const isNow = day === 5 || day === 6 || day === 0;
  const daysToFriday = isNow ? 0 : 5 - day;
  const friday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToFriday));
  const daysToSunday = day === 0 ? 0 : 7 - day;
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToSunday, 23, 59, 59, 999),
  );
  return { from: isNow ? now : friday, to, isNow };
}

export interface Collection {
  id: 'beach' | 'food' | 'nature' | 'culture';
  // Category slugs from the seeded catalog (api/src/database/seed-data.ts).
  categories: string[];
}

export const COLLECTIONS: Collection[] = [
  { id: 'beach', categories: ['beaches', 'islands-boat-trips'] },
  { id: 'food', categories: ['food-dining'] },
  { id: 'nature', categories: ['waterfalls-nature', 'hiking-adventure', 'wildlife-eco-tourism'] },
  { id: 'culture', categories: ['culture-heritage'] },
];

/** Explore, pre-filtered to a collection's categories. */
export function collectionHref(collection: Collection): string {
  return `/explore?category=${collection.categories.join(',')}`;
}

/** Drops items whose id was already shown higher on the page, keeping
 * order, so each section brings something new. */
export function withoutShown<T extends { id: string }>(items: T[], shown: Iterable<string>, limit?: number): T[] {
  const seen = new Set(shown);
  const fresh = items.filter((item) => !seen.has(item.id));
  return limit === undefined ? fresh : fresh.slice(0, limit);
}

export interface CollectionSummary {
  collection: Collection;
  count: number;
  // A real photo of a real place in this collection, or null.
  cover: string | null;
  coverPlaceId: string | null;
  coverPlaceName: string | null;
}

/** Counts come from the category list (approved places only); the cover
 * is the first place in `pool` from the collection that has a photo. */
export function summarizeCollections(categories: Category[], pool: Place[]): CollectionSummary[] {
  const counts = new Map(categories.map((c) => [c.slug, c.placeCount ?? 0]));
  return COLLECTIONS.map((collection) => {
    const slugs = new Set(collection.categories);
    const coverPlace = pool.find((place) => slugs.has(place.category.slug) && place.images.length > 0);
    return {
      collection,
      count: collection.categories.reduce((sum, slug) => sum + (counts.get(slug) ?? 0), 0),
      cover: coverPlace?.images[0] ?? null,
      coverPlaceId: coverPlace?.id ?? null,
      coverPlaceName: coverPlace?.name ?? null,
    };
  });
}
