import type {
  Business,
  Category,
  County,
  Creator,
  PaginatedCreators,
  PaginatedPlaces,
  PaginatedReviews,
  Place,
  PlacesQuery,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), {
    // Phase 1 catalog data changes slowly — a short revalidation window
    // keeps pages fast without serving stale content for long.
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `Request to ${path} failed with ${res.status}`);
  }

  // A Nest controller returning `null` (e.g. GET /businesses?placeId=... for
  // an unclaimed place) serializes to a 200 with an *empty* body, not the
  // text "null" — res.json() throws SyntaxError on that. Every other route
  // here always returns a real payload on success, so treating "no body" as
  // `null` is safe generally, not just for the one endpoint that needs it.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function getPlaces(query: PlacesQuery = {}): Promise<PaginatedPlaces> {
  return apiFetch<PaginatedPlaces>('/places', query as Record<string, string | number | undefined>);
}

export function getPlaceBySlug(slug: string): Promise<Place> {
  return apiFetch<Place>(`/places/${slug}`);
}

export function getCounties(): Promise<County[]> {
  return apiFetch<County[]>('/counties');
}

export function getCountyPlaces(countySlug: string, query: PlacesQuery = {}): Promise<PaginatedPlaces> {
  return apiFetch<PaginatedPlaces>(`/counties/${countySlug}/places`, query as Record<string, string | number | undefined>);
}

export function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories');
}

export function getReviews(placeId: string, query: { page?: number; limit?: number } = {}): Promise<PaginatedReviews> {
  return apiFetch<PaginatedReviews>('/reviews', { placeId, ...query });
}

// GET /businesses?placeId=... returns `null` (200, not 404) when nothing's
// been claimed yet — apiFetch's throw-on-!res.ok path never fires for it.
export function getBusinessByPlace(placeId: string): Promise<Business | null> {
  return apiFetch<Business | null>('/businesses', { placeId });
}

export function getCreators(query: { page?: number; limit?: number } = {}): Promise<PaginatedCreators> {
  return apiFetch<PaginatedCreators>('/creators', query);
}

export function getCreatorByUsername(username: string): Promise<Creator> {
  return apiFetch<Creator>(`/creators/${username}`);
}

export { ApiError };
