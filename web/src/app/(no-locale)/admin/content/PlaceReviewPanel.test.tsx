import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PlaceReviewPanel } from './PlaceReviewPanel';
import type { Place } from '@/lib/types';

const mockSetPlaceReviewStatus = jest.fn();

// jest.mock's module specifier is a plain string, not an import
// declaration — the '@/...' alias only gets resolved by SWC's transform on
// real import statements, so this needs the relative path to resolve to
// the same module PlaceReviewPanel imports via '@/lib/admin-api'.
jest.mock('../../../../lib/admin-api', () => ({
  setPlaceReviewStatus: (...args: unknown[]) => mockSetPlaceReviewStatus(...args),
}));

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place-1',
    name: 'Zew Pharmacy',
    slug: 'zew-pharmacy',
    description: 'A pharmacy.',
    type: 'attraction',
    category: { id: 'cat-1', name: 'Health', slug: 'health', description: null, icon: null },
    tags: [],
    county: {
      id: 'county-1',
      name: 'Montserrado',
      slug: 'montserrado',
      rolloutStage: 1,
      icon: null,
      emergencyNumber: null,
      safetyTips: [],
      localCustoms: null,
    },
    city: 'Habel',
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
    rating: 0,
    reviewCount: 0,
    verificationStatus: 'unverified',
    featured: false,
    reviewStatus: 'approved',
    ownerUserId: null,
    owner: null,
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    ...overrides,
  };
}

describe('PlaceReviewPanel — suspend/reinstate an approved place', () => {
  beforeEach(() => {
    mockSetPlaceReviewStatus.mockReset();
  });

  it('offers Suspend listing on an approved, admin-authored place (ownerUserId null)', () => {
    // This is the exact scenario that used to be unreachable: a place an
    // admin added directly (no owner, always created APPROVED) had no way
    // to come off the public site short of deleting it outright.
    render(<PlaceReviewPanel token="tok" place={place()} onUpdated={jest.fn()} />);

    expect(screen.getByRole('button', { name: /suspend listing/i })).toBeInTheDocument();
  });

  it('offers Suspend listing on an approved, self-submitted place too', () => {
    render(
      <PlaceReviewPanel
        token="tok"
        place={place({ ownerUserId: 'user-1', owner: { id: 'user-1', name: 'A Submitter' } as never })}
        onUpdated={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /suspend listing/i })).toBeInTheDocument();
  });

  it('suspends the place with a reason and reports the update', async () => {
    mockSetPlaceReviewStatus.mockResolvedValue(place({ reviewStatus: 'suspended' }));
    const onUpdated = jest.fn();

    render(<PlaceReviewPanel token="tok" place={place()} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole('button', { name: /suspend listing/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Closed permanently' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() =>
      expect(mockSetPlaceReviewStatus).toHaveBeenCalledWith('tok', 'place-1', 'suspended', 'Closed permanently'),
    );
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ reviewStatus: 'suspended' }));
  });

  it('offers Reinstate & publish on a suspended place', () => {
    render(<PlaceReviewPanel token="tok" place={place({ reviewStatus: 'suspended' })} onUpdated={jest.fn()} />);

    expect(screen.getByRole('button', { name: /reinstate & publish/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /suspend listing/i })).not.toBeInTheDocument();
  });
});
