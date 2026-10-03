import { distanceKm, type Coordinates } from './geo';
import { isOpenAt } from './opening-hours';
import { PRICE_BUCKETS } from '@/components/MobileFilterSheet';
import type { Place } from './types';

// Explore's filters live in the URL so opening a place and pressing Back
// lands on the same view, and a filtered map can be shared. The visitor's
// coordinates are never put in the URL (a shared link would leak where
// they are): only `near=1` and the radius go there, and the point itself
// stays in this tab's sessionStorage.

export const RADIUS_OPTIONS_KM = [2, 5, 10, 25, 50] as const;
export const DEFAULT_RADIUS_KM = 10;

export interface ExploreFilters {
  // Empty means every category.
  categories: string[];
  county: string | null;
  price: string;
  open: boolean;
  q: string;
  near: boolean;
  radiusKm: number;
  selected: string | null;
}

export const EMPTY_FILTERS: ExploreFilters = {
  categories: [],
  county: null,
  price: '',
  open: false,
  q: '',
  near: false,
  radiusKm: DEFAULT_RADIUS_KM,
  selected: null,
};

export function parseExploreParams(params: URLSearchParams): ExploreFilters {
  const radius = Number(params.get('radius'));
  const price = params.get('price') ?? '';
  return {
    categories: (params.get('category') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    county: params.get('county') || null,
    price: PRICE_BUCKETS.some((b) => b.id === price) ? price : '',
    open: params.get('open') === '1',
    q: params.get('q') ?? '',
    near: params.get('near') === '1',
    radiusKm: (RADIUS_OPTIONS_KM as readonly number[]).includes(radius) ? radius : DEFAULT_RADIUS_KM,
    selected: params.get('place') || null,
  };
}

/** Only non-default values, in a stable order, so URLs stay short. */
export function serializeExploreParams(filters: ExploreFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.categories.length > 0) params.set('category', filters.categories.join(','));
  if (filters.county) params.set('county', filters.county);
  if (filters.price) params.set('price', filters.price);
  if (filters.open) params.set('open', '1');
  if (filters.near) {
    params.set('near', '1');
    if (filters.radiusKm !== DEFAULT_RADIUS_KM) params.set('radius', String(filters.radiusKm));
  }
  if (filters.selected) params.set('place', filters.selected);
  // URLSearchParams encodes commas; they're safe in a query string and
  // much easier to read.
  return params.toString().replace(/%2C/g, ',');
}

export function activeFilterCount(filters: ExploreFilters): number {
  return (
    (filters.categories.length > 0 ? 1 : 0) +
    (filters.county ? 1 : 0) +
    (filters.price ? 1 : 0) +
    (filters.open ? 1 : 0) +
    (filters.near ? 1 : 0)
  );
}

export interface PlaceResult {
  place: Place;
  // Kilometres from the chosen point, when one is set.
  distanceKm: number | null;
}

/** Applies every filter. With a point set, results are limited to the
 * radius and sorted nearest first; otherwise the catalog order is kept. */
export function filterPlaces(
  places: Place[],
  filters: ExploreFilters,
  origin: Coordinates | null,
  now: Date = new Date(),
): PlaceResult[] {
  const q = filters.q.trim().toLowerCase();
  const categories = new Set(filters.categories);
  const bucket = PRICE_BUCKETS.find((b) => b.id === filters.price && b.id !== '');
  const point = filters.near ? origin : null;

  const results: PlaceResult[] = [];
  for (const place of places) {
    if (categories.size > 0 && !categories.has(place.category.slug)) continue;
    if (filters.county && place.county.slug !== filters.county) continue;
    if (filters.open && !isOpenAt(place.structuredHours, now)) continue;
    if (bucket) {
      // No price on file is excluded rather than guessed.
      if (place.estimatedCostEntry == null) continue;
      if (bucket.min != null && place.estimatedCostEntry < bucket.min) continue;
      if (bucket.max != null && place.estimatedCostEntry > bucket.max) continue;
    }
    if (
      q &&
      !place.name.toLowerCase().includes(q) &&
      !place.description.toLowerCase().includes(q) &&
      !place.category.name.toLowerCase().includes(q) &&
      !place.county.name.toLowerCase().includes(q)
    ) {
      continue;
    }
    let distance: number | null = null;
    if (point) {
      distance = distanceKm(point, { lat: place.latitude, lng: place.longitude });
      if (distance > filters.radiusKm) continue;
    }
    results.push({ place, distanceKm: distance });
  }
  if (point) results.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return results;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

const ORIGIN_KEY = 'liberia360:explore-origin';

export interface StoredOrigin extends Coordinates {
  // Where the point came from: the device, or a tap on the map.
  source: 'device' | 'manual';
}

export function loadOrigin(): StoredOrigin | null {
  try {
    const raw = window.sessionStorage.getItem(ORIGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredOrigin>;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null;
    return { lat: parsed.lat, lng: parsed.lng, source: parsed.source === 'manual' ? 'manual' : 'device' };
  } catch {
    return null;
  }
}

export function saveOrigin(origin: StoredOrigin | null): void {
  try {
    if (origin) window.sessionStorage.setItem(ORIGIN_KEY, JSON.stringify(origin));
    else window.sessionStorage.removeItem(ORIGIN_KEY);
  } catch {
    // Storage blocked: the point just won't survive a reload.
  }
}
