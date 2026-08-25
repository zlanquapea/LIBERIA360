import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NearMeClient } from './NearMeClient';
import type { Category, Place } from '@/lib/types';

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Food & Dining', slug: 'food-dining', description: null, icon: 'CakeIcon' },
  { id: 'c2', name: 'Hotels & Lodges', slug: 'hotels-lodges', description: null, icon: 'HomeModernIcon' },
];

const BASE_PLACE: Place = {
  id: 'p1',
  name: 'CeeCee Beach',
  slug: 'ceecee-beach',
  description: 'A quiet beach just outside Monrovia.',
  type: 'nature_site',
  category: { id: 'c1', name: 'Food & Dining', slug: 'food-dining', description: null, icon: 'CakeIcon' },
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

// apiFetch reads the body via res.text() (not res.json()) — see its doc
// comment on why (distinguishing a genuinely empty body from `null`).
function fetchResponse(body: unknown) {
  return { ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) };
}

function mockFetchJson(body: unknown) {
  global.fetch = jest.fn().mockResolvedValue(fetchResponse(body)) as unknown as typeof fetch;
}

function mockGeolocationSuccess() {
  const getCurrentPosition = jest.fn((success: PositionCallback) => {
    success({ coords: { latitude: 6.3, longitude: -10.8 } } as GeolocationPosition);
  });
  Object.defineProperty(global.navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
}

function page(data: Place[]) {
  return { data, meta: { total: data.length, page: 1, limit: 30, totalPages: 1 } };
}

describe('NearMeClient', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prompts for location before showing any filters', () => {
    render(<NearMeClient categories={CATEGORIES} />);
    expect(screen.getByRole('button', { name: /use my location/i })).toBeInTheDocument();
    expect(screen.queryByText('Everything')).not.toBeInTheDocument();
  });

  it('shows radius presets and category chips once location is granted', async () => {
    mockGeolocationSuccess();
    mockFetchJson(page([BASE_PLACE]));

    render(<NearMeClient categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole('button', { name: /use my location/i }));

    expect(await screen.findByRole('button', { name: 'Everything' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /food & dining/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hotels & lodges/i })).toBeInTheDocument();
    expect(await screen.findByText('CeeCee Beach')).toBeInTheDocument();
  });

  it('re-fetches with the category slug when a category chip is selected', async () => {
    mockGeolocationSuccess();
    mockFetchJson(page([BASE_PLACE]));

    render(<NearMeClient categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole('button', { name: /use my location/i }));
    await screen.findByText('CeeCee Beach');

    await userEvent.click(screen.getByRole('button', { name: /food & dining/i }));

    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const lastUrl = calls[calls.length - 1][0] as string;
      expect(lastUrl).toContain('category=food-dining');
      expect(lastUrl).toContain('radiusKm=10');
    });
  });

  it('keeps the category filter applied when silently checking the widest radius fallback', async () => {
    mockGeolocationSuccess();
    // Call 1: initial "Use my location" fetch (no category yet) — non-empty,
    // so no fallback fires at this stage. Call 2: category selected, empty
    // within 10km. Call 3: the silent widest-radius fallback, still scoped
    // to the same category, non-empty.
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(fetchResponse(page([BASE_PLACE])))
      .mockResolvedValueOnce(fetchResponse(page([])))
      .mockResolvedValueOnce(fetchResponse(page([BASE_PLACE]))) as unknown as typeof fetch;

    render(<NearMeClient categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole('button', { name: /use my location/i }));
    await screen.findByText('CeeCee Beach');
    await userEvent.click(screen.getByRole('button', { name: /food & dining/i }));

    await screen.findByText(/no food & dining within 10 km/i);
    expect(screen.getByText('CeeCee Beach')).toBeInTheDocument();

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).not.toContain('category=');
    expect(calls[1][0]).toContain('category=food-dining');
    expect(calls[2][0]).toContain('category=food-dining');
    expect(calls[2][0]).toContain('radiusKm=200');
  });

  it('offers to clear the category filter from the empty state, showing everything nearby again', async () => {
    mockGeolocationSuccess();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(fetchResponse(page([BASE_PLACE]))) // initial, no category
      .mockResolvedValueOnce(fetchResponse(page([]))) // category selected, within radius
      .mockResolvedValueOnce(fetchResponse(page([]))) // category selected, fallback radius
      .mockResolvedValueOnce(fetchResponse(page([BASE_PLACE]))) as unknown as typeof fetch; // category cleared

    render(<NearMeClient categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole('button', { name: /use my location/i }));
    await screen.findByText('CeeCee Beach');
    await userEvent.click(screen.getByRole('button', { name: /food & dining/i }));

    const clearButton = await screen.findByRole('button', { name: /show everything nearby/i });
    await userEvent.click(clearButton);

    expect(await screen.findByText('CeeCee Beach')).toBeInTheDocument();
    const calls = (global.fetch as jest.Mock).mock.calls;
    const lastUrl = calls[calls.length - 1][0] as string;
    expect(lastUrl).not.toContain('category=');
  });
});
