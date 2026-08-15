import type { Category, County, PaginatedPlaces, PaginatedReviews, Place, PlacesQuery } from './types';

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

  return res.json() as Promise<T>;
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

export { ApiError };
