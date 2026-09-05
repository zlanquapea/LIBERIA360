import {
  cachePlaceSnapshot,
  clearSavedPlacesOnLogout,
  getCachedPlaceSnapshot,
  getSavedSlugs,
  hasSyncedSavedPlacesForUser,
  isPlaceSaved,
  markSavedPlacesSyncedForUser,
  setSavedSlugs,
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

describe('saved-places (cross-device sync)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    markSavedPlacesSyncedForUser(null);
  });

  it('setSavedSlugs overwrites the whole list at once, de-duplicated', () => {
    toggleSavedPlace('test-beach');
    setSavedSlugs(['ceecee-beach', 'ceecee-beach', 'sapo-national-park']);
    expect(getSavedSlugs().sort()).toEqual(['ceecee-beach', 'sapo-national-park']);
  });

  it('setSavedSlugs notifies same-tab subscribers, same as toggling', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeToSavedPlaces(callback);
    setSavedSlugs(['ceecee-beach']);
    expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('clearSavedPlacesOnLogout wipes both the slug list and the offline snapshot cache', () => {
    toggleSavedPlace('test-beach');
    cachePlaceSnapshot(PLACE);

    clearSavedPlacesOnLogout();

    expect(getSavedSlugs()).toEqual([]);
    expect(getCachedPlaceSnapshot('test-beach')).toBeNull();
  });

  it('clearSavedPlacesOnLogout resets the once-per-login sync guard', () => {
    markSavedPlacesSyncedForUser('user-1');
    expect(hasSyncedSavedPlacesForUser('user-1')).toBe(true);

    clearSavedPlacesOnLogout();

    expect(hasSyncedSavedPlacesForUser('user-1')).toBe(false);
  });

  it('the sync guard tracks the current user only — logging in as someone else needs its own sync', () => {
    markSavedPlacesSyncedForUser('user-1');
    expect(hasSyncedSavedPlacesForUser('user-1')).toBe(true);
    expect(hasSyncedSavedPlacesForUser('user-2')).toBe(false);
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
