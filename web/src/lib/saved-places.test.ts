import {
  cachePlaceSnapshot,
  getCachedPlaceSnapshot,
  getSavedSlugs,
  isPlaceSaved,
  subscribeToSavedPlaces,
  toggleSavedPlace,
} from './saved-places';
import type { Place } from './types';

const PLACE: Place = {
  id: 'p1',
  name: 'Test Beach',
  slug: 'test-beach',
  description: 'A beach.',
  type: 'nature_site',
  category: { id: 'c1', name: 'Beaches', slug: 'beaches', description: null, icon: null },
  tags: [],
  county: {
    id: 'co1',
    name: 'Montserrado',
    slug: 'montserrado',
    rolloutStage: 1,
    icon: null,
    emergencyNumber: null,
    safetyTips: [],
    localCustoms: null,
  },
  city: 'Monrovia',
  latitude: 6.3,
  longitude: -10.8,
  distanceFromMonroviaKm: 5,
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
  rating: 4.5,
  reviewCount: 3,
  verificationStatus: 'verified',
  featured: false,
  reviewStatus: 'approved',
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

describe('saved-places (slugs)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with no saved places', () => {
    expect(getSavedSlugs()).toEqual([]);
    expect(isPlaceSaved('test-beach')).toBe(false);
  });

  it('toggling an unsaved place saves it and returns true', () => {
    const nowSaved = toggleSavedPlace('test-beach');
    expect(nowSaved).toBe(true);
    expect(isPlaceSaved('test-beach')).toBe(true);
    expect(getSavedSlugs()).toEqual(['test-beach']);
  });

  it('toggling an already-saved place unsaves it and returns false', () => {
    toggleSavedPlace('test-beach');
    const nowSaved = toggleSavedPlace('test-beach');
    expect(nowSaved).toBe(false);
    expect(isPlaceSaved('test-beach')).toBe(false);
    expect(getSavedSlugs()).toEqual([]);
  });

  it('unsaving a place also clears its cached offline snapshot', () => {
    toggleSavedPlace('test-beach');
    cachePlaceSnapshot(PLACE);
    expect(getCachedPlaceSnapshot('test-beach')).not.toBeNull();

    toggleSavedPlace('test-beach'); // unsave
    expect(getCachedPlaceSnapshot('test-beach')).toBeNull();
  });

  it('notifies same-tab subscribers when the saved list changes', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeToSavedPlaces(callback);

    toggleSavedPlace('test-beach');
    expect(callback).toHaveBeenCalledTimes(1);

    unsubscribe();
    toggleSavedPlace('test-beach');
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

describe('saved-places (offline snapshot cache)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null for a place that was never cached', () => {
    expect(getCachedPlaceSnapshot('test-beach')).toBeNull();
  });

  it('round-trips a place through cachePlaceSnapshot/getCachedPlaceSnapshot', () => {
    cachePlaceSnapshot(PLACE);
    const snapshot = getCachedPlaceSnapshot('test-beach');
    expect(snapshot?.place).toEqual(PLACE);
    expect(typeof snapshot?.cachedAt).toBe('string');
  });

  it('overwrites the previous snapshot for the same slug rather than duplicating it', () => {
    cachePlaceSnapshot(PLACE);
    const updated: Place = { ...PLACE, name: 'Renamed Beach' };
    cachePlaceSnapshot(updated);
    expect(getCachedPlaceSnapshot('test-beach')?.place.name).toBe('Renamed Beach');
  });
});
