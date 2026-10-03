import {
  DEFAULT_RADIUS_KM,
  EMPTY_FILTERS,
  activeFilterCount,
  filterPlaces,
  formatDistance,
  parseExploreParams,
  serializeExploreParams,
} from './explore-filters';
import type { Place } from './types';

const MONTSERRADO = { id: 'c1', name: 'Montserrado', slug: 'montserrado', rolloutStage: 1, icon: null, emergencyNumber: null, safetyTips: [], localCustoms: null };
const BONG = { ...MONTSERRADO, id: 'c2', name: 'Bong', slug: 'bong' };
const BEACH = { id: 'k1', name: 'Beaches', slug: 'beaches', description: null, icon: null };
const FOOD = { id: 'k2', name: 'Food & Dining', slug: 'food-dining', description: null, icon: null };

function place(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    slug: id,
    name: id,
    description: '',
    type: 'beach',
    category: BEACH,
    tags: [],
    county: MONTSERRADO,
    city: null,
    latitude: 6.3,
    longitude: -10.8,
    distanceFromMonroviaKm: null,
    recommendedVisitLength: null,
    estimatedCostEntry: null,
    estimatedCostGuide: null,
    estimatedCostTransport: null,
    images: [],
    videos: [],
    openingHours: null,
    structuredHours: null,
    contactPhone: null,
    whatsapp: null,
    website: null,
    instagram: null,
    facebook: null,
    amenities: [],
    accessibilityNotes: null,
    transportNotes: null,
    practicalInfoSource: null,
    practicalInfoCheckedAt: null,
    rating: 0,
    reviewCount: 0,
    verificationStatus: 'unverified',
    featured: false,
    reviewStatus: 'approved',
    ownerUserId: null,
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    ...overrides,
  } as Place;
}

describe('explore URL params', () => {
  it('round-trips every filter, keeping commas readable', () => {
    const filters = {
      ...EMPTY_FILTERS,
      q: 'surf',
      categories: ['beaches', 'islands-boat-trips'],
      county: 'grand-cape-mount',
      price: 'under10',
      open: true,
      near: true,
      radiusKm: 25,
      selected: 'robertsport',
    };
    const qs = serializeExploreParams(filters);
    expect(qs).toContain('category=beaches,islands-boat-trips');
    expect(parseExploreParams(new URLSearchParams(qs))).toEqual(filters);
  });

  it('drops defaults and never carries coordinates', () => {
    expect(serializeExploreParams(EMPTY_FILTERS)).toBe('');
    expect(serializeExploreParams({ ...EMPTY_FILTERS, near: true })).toBe('near=1');
  });

  it('ignores unknown price buckets and radii', () => {
    const parsed = parseExploreParams(new URLSearchParams('price=cheap&radius=7&near=1'));
    expect(parsed.price).toBe('');
    expect(parsed.radiusKm).toBe(DEFAULT_RADIUS_KM);
  });

  it('counts active filters, not the search text', () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: 'x' })).toBe(0);
    expect(activeFilterCount({ ...EMPTY_FILTERS, categories: ['a', 'b'], open: true })).toBe(2);
  });
});

describe('filterPlaces', () => {
  const places = [
    place('beach-free', { estimatedCostEntry: 0 }),
    place('grill', { category: FOOD, estimatedCostEntry: 15, county: BONG, latitude: 7.0, longitude: -9.47 }),
    place('unpriced-beach'),
  ];

  it('filters by any of several categories', () => {
    const r = filterPlaces(places, { ...EMPTY_FILTERS, categories: ['food-dining', 'beaches'] }, null);
    expect(r).toHaveLength(3);
    expect(filterPlaces(places, { ...EMPTY_FILTERS, categories: ['food-dining'] }, null).map((x) => x.place.id)).toEqual(['grill']);
  });

  it('excludes places with no price on file once a price filter is set', () => {
    const r = filterPlaces(places, { ...EMPTY_FILTERS, price: 'under10' }, null);
    expect(r.map((x) => x.place.id)).toEqual(['beach-free']);
  });

  it('matches search text against county and category names too', () => {
    expect(filterPlaces(places, { ...EMPTY_FILTERS, q: 'bong' }, null).map((x) => x.place.id)).toEqual(['grill']);
  });

  it('limits to the radius and sorts nearest first when a point is set', () => {
    const origin = { lat: 6.99, lng: -9.47 };
    const near = filterPlaces(places, { ...EMPTY_FILTERS, near: true, radiusKm: 5 }, origin);
    expect(near.map((x) => x.place.id)).toEqual(['grill']);
    expect(near[0].distanceKm).toBeLessThan(5);

    const wide = filterPlaces(places, { ...EMPTY_FILTERS, near: true, radiusKm: 200 }, origin);
    expect(wide[0].place.id).toBe('grill');
  });

  it('ignores distance when near is off, even with a stored point', () => {
    const r = filterPlaces(places, EMPTY_FILTERS, { lat: 0, lng: 0 });
    expect(r).toHaveLength(3);
    expect(r[0].distanceKm).toBeNull();
  });
});

it('formats distances', () => {
  expect(formatDistance(0.42)).toBe('420 m');
  expect(formatDistance(3.26)).toBe('3.3 km');
  expect(formatDistance(42.4)).toBe('42 km');
});
