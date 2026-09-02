import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CountyPlacesExplorer } from './CountyPlacesExplorer';
import type { Place } from '@/lib/types';

const COUNTY = {
  id: 'co1',
  name: 'Bong',
  slug: 'bong',
  rolloutStage: 2,
  icon: null,
  emergencyNumber: null,
  safetyTips: [],
  localCustoms: null,
};

function makePlace(overrides: Partial<Place> & { id: string; name: string }): Place {
  return {
    slug: overrides.id,
    description: 'A place worth visiting.',
    type: 'nature_site',
    category: { id: 'cat-nature', name: 'Nature & Outdoors', slug: 'nature-outdoors', description: null, icon: null },
    tags: [],
    county: COUNTY,
    city: 'Gbarnga',
    latitude: 6.99,
    longitude: -9.47,
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
    verificationStatus: 'unverified',
    featured: false,
    reviewStatus: 'approved',
    ownerUserId: null,
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    ...overrides,
  };
}

describe('CountyPlacesExplorer', () => {
  it('skips the search/filter toolbar entirely for a thin, single-category catalog', () => {
    const places = [makePlace({ id: 'p1', name: 'Kpatawee Waterfall' })];
    render(<CountyPlacesExplorer places={places} countyName="Bong" />);

    expect(screen.getByText('Kpatawee Waterfall')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();
  });

  it('shows the toolbar once there are enough places, and filters by category', async () => {
    const food = { id: 'cat-food', name: 'Food & Dining', slug: 'food-dining', description: null, icon: null };
    const places = [
      makePlace({ id: 'p1', name: 'Kpatawee Waterfall' }),
      makePlace({ id: 'p2', name: 'Gbarnga Lodge' }),
      makePlace({ id: 'p3', name: 'Cuttington Guesthouse' }),
      makePlace({ id: 'p4', name: 'Suakoko Grill', category: food }),
      makePlace({ id: 'p5', name: 'Phebe Falls' }),
      makePlace({ id: 'p6', name: 'Bong Mines Trail' }),
    ];
    render(<CountyPlacesExplorer places={places} countyName="Bong" />);

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByText('6 places')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /food & dining/i }));
    expect(screen.getByText('Suakoko Grill')).toBeInTheDocument();
    expect(screen.queryByText('Kpatawee Waterfall')).not.toBeInTheDocument();
    expect(screen.getByText('1 of 6 places')).toBeInTheDocument();
  });

  it('filters by search text and offers to clear when nothing matches', async () => {
    const places = Array.from({ length: 6 }, (_, i) => makePlace({ id: `p${i}`, name: `Place ${i}` }));
    render(<CountyPlacesExplorer places={places} countyName="Bong" />);

    await userEvent.type(screen.getByRole('textbox'), 'nonexistent place');

    expect(screen.getByText(/no places in bong/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByText('Place 0')).toBeInTheDocument();
  });
});
