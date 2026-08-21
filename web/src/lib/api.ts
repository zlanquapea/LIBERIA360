import type {
  Business,
  BusinessType,
  Category,
  County,
  Creator,
  CreatorCategory,
  Event,
  EventCategory,
  PaginatedBusinessContent,
  PaginatedBusinesses,
  PaginatedCreators,
  PaginatedEvents,
  PaginatedPlaces,
  PaginatedReviews,
  Place,
  PlacesQuery,
  SponsoredPlacement,
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

// `next build` prerenders every page with no dynamic route segment (Home,
// /counties, /creators, /search, ...) up front, which means the catalog
// fetches those pages make run *during the build itself* — before the app
// is actually deployed anywhere. If the API isn't reachable yet at that
// exact moment (the common case: it's the first deploy, or the two
// services on a host like Railway/Render just haven't both come up yet),
// the raw `fetch()` call throws a connection error, and Next.js treats an
// uncaught error during static generation as a fatal build failure — the
// whole site fails to build over what's really just an ordering problem,
// not a real bug.
//
// `NEXT_PHASE` is a real Next.js env var, set to this exact value only
// while `next build` is running (see Next.js's own build-phase docs) —
// never during `next dev` or while actually serving requests. So this
// only ever applies during that one narrow window: if a connection-level
// failure happens then, log it and fall back to an empty result instead
// of crashing the build. ISR (`next: { revalidate: 60 }` below) means the
// very first real visitor after deploy — by which point the API is
// actually up — refetches and replaces this placeholder with real data.
// A genuine HTTP error response (res.ok false) is NOT covered by this —
// that means the API *is* reachable and said something's actually wrong,
// which should still fail loudly rather than be silently hidden.
const IS_BUILD_PHASE = process.env.NEXT_PHASE === 'phase-production-build';

function emptyPage(limit = 20) {
  return { data: [], meta: { total: 0, page: 1, limit, totalPages: 1 } };
}

async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  buildFallback?: T,
): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      // Phase 1 catalog data changes slowly — a short revalidation window
      // keeps pages fast without serving stale content for long.
      next: { revalidate: 60 },
    });
  } catch (err) {
    if (IS_BUILD_PHASE && buildFallback !== undefined) {
      // eslint-disable-next-line no-console
      console.warn(`[build] ${path} unreachable at build time, using an empty placeholder: ${(err as Error).message}`);
      return buildFallback;
    }
    throw err;
  }

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
  return apiFetch<PaginatedPlaces>(
    '/places',
    query as Record<string, string | number | undefined>,
    emptyPage(query.limit),
  );
}

export function getPlaceBySlug(slug: string): Promise<Place> {
  return apiFetch<Place>(`/places/${slug}`);
}

export function getCounties(): Promise<County[]> {
  return apiFetch<County[]>('/counties', undefined, []);
}

export function getCountyPlaces(countySlug: string, query: PlacesQuery = {}): Promise<PaginatedPlaces> {
  return apiFetch<PaginatedPlaces>(`/counties/${countySlug}/places`, query as Record<string, string | number | undefined>);
}

export function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories', undefined, []);
}

export function getReviews(placeId: string, query: { page?: number; limit?: number } = {}): Promise<PaginatedReviews> {
  return apiFetch<PaginatedReviews>('/reviews', { placeId, ...query });
}

// GET /businesses?placeId=... returns `null` (200, not 404) when nothing's
// been claimed yet — apiFetch's throw-on-!res.ok path never fires for it.
// Only ever an APPROVED listing — see BusinessesService.findByPlace's doc
// comment for why a still-pending/rejected claim isn't returned here.
export function getBusinessByPlace(placeId: string): Promise<Business | null> {
  return apiFetch<Business | null>('/businesses', { placeId });
}

export interface BusinessesQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: BusinessType;
  countyId?: string;
}

// The discovery directory — approved listings only, same as
// getBusinessByPlace above.
export function getBusinesses(query: BusinessesQuery = {}): Promise<PaginatedBusinesses> {
  return apiFetch<PaginatedBusinesses>('/businesses', { ...query }, emptyPage(query.limit));
}

export function getBusinessBySlug(slug: string): Promise<Business> {
  return apiFetch<Business>(`/businesses/slug/${slug}`);
}

// Approved-only, same gate as every other public business lookup above.
export function getBusinessContent(
  businessId: string,
  query: { page?: number; limit?: number } = {},
): Promise<PaginatedBusinessContent> {
  return apiFetch<PaginatedBusinessContent>(
    '/business-content',
    { businessId, ...query },
    emptyPage(query.limit),
  );
}

export function getActiveSponsoredPlacements(): Promise<SponsoredPlacement[]> {
  return apiFetch<SponsoredPlacement[]>('/sponsored-placements/active', undefined, []);
}

export interface CreatorsQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: CreatorCategory;
  countyId?: string;
  featuredOnly?: boolean;
}

export function getCreators(query: CreatorsQuery = {}): Promise<PaginatedCreators> {
  return apiFetch<PaginatedCreators>(
    '/creators',
    { ...query, featuredOnly: query.featuredOnly ? 'true' : undefined },
    emptyPage(query.limit),
  );
}

export function getCreatorByUsername(username: string): Promise<Creator> {
  return apiFetch<Creator>(`/creators/${username}`);
}

export interface EventsQuery {
  category?: EventCategory;
  county?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function getEvents(query: EventsQuery = {}): Promise<PaginatedEvents> {
  return apiFetch<PaginatedEvents>(
    '/events',
    query as Record<string, string | number | undefined>,
    emptyPage(query.limit),
  );
}

export function getEvent(id: string): Promise<Event> {
  return apiFetch<Event>(`/events/${id}`);
}

export { ApiError };
