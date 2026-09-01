import { savePendingTripDraft, takePendingTripDraft, type PendingTripDraft } from './pending-trip-draft';
import type { Place } from './types';

const DESTINATION = {
  id: 'p1',
  name: 'Robertsport',
  slug: 'robertsport',
  description: 'Surf town',
  type: 'beach',
  category: { id: 'c1', name: 'Beaches', slug: 'beaches', description: null, icon: null },
  tags: [],
  county: { id: 'cty1', name: 'Grand Cape Mount', slug: 'grand-cape-mount', rolloutStage: 1, icon: null, emergencyNumber: null, safetyTips: [], localCustoms: null },
  city: 'Robertsport',
  latitude: 6.75,
  longitude: -11.37,
  distanceFromMonroviaKm: 120,
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
  rating: 0,
  reviewCount: 0,
  verificationStatus: 'verified',
  featured: false,
  reviewStatus: 'approved',
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
} as unknown as Place;

const DRAFT: PendingTripDraft = {
  startDate: '2026-12-05',
  endDate: '2026-12-08',
  budgetBand: 'premium',
  interests: ['hiking'],
  title: 'Weekend',
  destinationPlaceId: DESTINATION.id,
  visibility: 'private',
  destination: DESTINATION,
};

describe('pending-trip-draft', () => {
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('returns null when nothing was ever saved', () => {
    expect(takePendingTripDraft()).toBeNull();
  });

  it('round-trips a saved draft and consumes it on read', () => {
    savePendingTripDraft(DRAFT);

    expect(takePendingTripDraft()).toEqual(DRAFT);
    // Gone after the first read — a stale draft can't resurrect itself on
    // a later, unrelated visit.
    expect(takePendingTripDraft()).toBeNull();
  });

  it('ignores corrupted storage instead of throwing', () => {
    window.sessionStorage.setItem('liberia360:pending-trip-draft', '{not json');
    expect(takePendingTripDraft()).toBeNull();
  });

  it('ignores a value with the wrong shape', () => {
    window.sessionStorage.setItem('liberia360:pending-trip-draft', JSON.stringify({ foo: 'bar' }));
    expect(takePendingTripDraft()).toBeNull();
  });
});
