import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripPlannerForm } from './TripPlannerForm';
import { setStoredAuth, clearStoredAuth } from '@/lib/auth-storage';
import { savePendingTripDraft, takePendingTripDraft } from '@/lib/pending-trip-draft';
import { getPlaces } from '../lib/api';
import type { AuthUser, Place } from '@/lib/types';

// jest.mock's module specifier is a plain string, not an import
// declaration — the '@/...' alias only gets resolved by SWC's transform
// on real import statements, so this needs the relative path to resolve
// to the same module DestinationAutocomplete imports via '@/lib/api'.
jest.mock('../lib/api', () => ({
  getPlaces: jest.fn(),
}));

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as typeof fetch;
}

const USER: AuthUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  phone: null,
  authProvider: 'email',
  homeCounty: null,
  isAdmin: false,
  isSuperAdmin: false,
  travelerType: null,
  interests: [],
  twoFactorEnabled: false,
  emailVerified: true,
  pendingActivation: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const DESTINATION: Place = {
  id: 'p-robertsport',
  name: 'Robertsport',
  slug: 'robertsport',
  description: 'Surf town',
  type: 'beach' as Place['type'],
  category: { id: 'c1', name: 'Beaches', slug: 'beaches', description: null, icon: 'SunIcon' },
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
  verificationStatus: 'verified' as Place['verificationStatus'],
  featured: false,
  reviewStatus: 'approved' as Place['reviewStatus'],
  ownerUserId: null,
  rejectionReason: null,
  submittedAt: null,
  reviewedAt: null,
  reviewedByUserId: null,
};

const STOP = {
  day: 1,
  order: 0,
  notes: null,
  place: {
    id: 'p1',
    slug: 'robertsport',
    name: 'Robertsport',
    type: 'beach',
    city: 'Robertsport',
    category: { id: 'c1', name: 'Beaches', slug: 'beaches', description: null, icon: 'SunIcon' },
  },
};

// Fills the required name + destination fields (Aug 2026 social-trip spec)
// shared by every "actually submits" test below — picking the destination
// exercises the real DestinationAutocomplete search-and-select flow rather
// than reaching into component state.
async function fillRequiredFields(name: string) {
  (getPlaces as jest.Mock).mockResolvedValue({ data: [DESTINATION], meta: { total: 1, page: 1, limit: 8, totalPages: 1 } });
  await userEvent.type(screen.getByLabelText(/trip name/i), name);
  await userEvent.type(screen.getByPlaceholderText(/robertsport/i), 'Robert');
  await screen.findByText('Robertsport');
  await userEvent.click(screen.getByText('Robertsport'));
}

describe('TripPlannerForm', () => {
  afterEach(() => {
    clearStoredAuth();
    window.sessionStorage.clear();
    jest.restoreAllMocks();
    push.mockClear();
  });

  it('lets a signed-out visitor preview a trip with no login prompt', async () => {
    mockFetchOnce(201, {
      title: '3-Day Liberia Trip',
      kind: 'trip',
      durationDays: 3,
      budgetBand: 'moderate',
      interests: [],
      stops: [STOP],
    });

    render(<TripPlannerForm />);
    await fillRequiredFields('3-Day Liberia Trip');

    await userEvent.click(screen.getByRole('button', { name: /preview my trip/i }));

    expect(await screen.findByText('3-Day Liberia Trip')).toBeInTheDocument();
    expect(screen.getByText(/nothing.s saved yet/i)).toBeInTheDocument();
    expect(screen.getByText('Robertsport')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in to save this trip/i })).toBeInTheDocument();

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/itineraries/preview');
    expect(push).not.toHaveBeenCalled();
  });

  it('stashes the previewed inputs and sends a guest to log in when they choose to save', async () => {
    mockFetchOnce(201, {
      title: '3-Day Liberia Trip',
      kind: 'trip',
      durationDays: 3,
      budgetBand: 'moderate',
      interests: [],
      stops: [STOP],
    });

    render(<TripPlannerForm />);
    await fillRequiredFields('3-Day Liberia Trip');
    await userEvent.click(screen.getByRole('button', { name: /preview my trip/i }));
    await screen.findByRole('button', { name: /log in to save this trip/i });

    await userEvent.click(screen.getByRole('button', { name: /log in to save this trip/i }));

    expect(push).toHaveBeenCalledWith('/login?next=/trips/new');
    expect(takePendingTripDraft()).toEqual({
      durationDays: 3,
      budgetBand: 'moderate',
      interests: [],
      title: '3-Day Liberia Trip',
      destinationPlaceId: DESTINATION.id,
      visibility: 'private',
      destination: DESTINATION,
    });
  });

  it('auto-saves a resumed draft the instant a returning visitor is signed in', async () => {
    savePendingTripDraft({
      durationDays: 5,
      budgetBand: 'budget',
      interests: ['beaches'],
      title: 'My Trip',
      destinationPlaceId: DESTINATION.id,
      visibility: 'public',
      destination: DESTINATION,
    });
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(201, { id: 'itin-1', title: 'My Trip' });

    render(<TripPlannerForm />);

    expect(await screen.findByText(/saving your trip/i)).toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/trips/itin-1'));

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/itineraries');
    expect(JSON.parse(init.body)).toEqual({
      durationDays: 5,
      budgetBand: 'budget',
      interests: ['beaches'],
      title: 'My Trip',
      destinationPlaceId: DESTINATION.id,
      visibility: 'public',
    });
    // Consumed, not left behind for a later unrelated visit.
    expect(window.sessionStorage.getItem('liberia360:pending-trip-draft')).toBeNull();
  });

  it('sends startLat/startLng once "Use my current location" resolves', async () => {
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      success({ coords: { latitude: 6.3, longitude: -10.8 } } as GeolocationPosition);
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(201, { id: 'itin-3', title: '3-Day Liberia Trip' });

    render(<TripPlannerForm />);
    await fillRequiredFields('3-Day Liberia Trip');
    await userEvent.click(screen.getByRole('button', { name: /use my current location/i }));
    expect(await screen.findByText(/using your current location/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^build my trip$/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/trips/itin-3'));
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual(
      expect.objectContaining({ startLat: 6.3, startLng: -10.8 }),
    );
  });

  it('shows a friendly error and never blocks trip building when location access is denied', async () => {
    const getCurrentPosition = jest.fn((_success: PositionCallback, error: PositionErrorCallback) => {
      error({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true,
    });

    render(<TripPlannerForm />);
    await userEvent.click(screen.getByRole('button', { name: /use my current location/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/location access was denied/i);
    // Still fully usable without a location — the field is optional.
    expect(screen.getByRole('button', { name: /preview my trip/i })).toBeEnabled();
  });

  it('requires a trip name and destination before it can be built', async () => {
    render(<TripPlannerForm />);

    await userEvent.click(screen.getByRole('button', { name: /preview my trip/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/give your trip a name/i);

    await userEvent.type(screen.getByLabelText(/trip name/i), 'My Trip');
    await userEvent.click(screen.getByRole('button', { name: /preview my trip/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose a destination/i);
  });

  it('signed-in visitors with no pending draft still build and save a trip directly', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(201, { id: 'itin-2', title: '3-Day Liberia Trip' });

    render(<TripPlannerForm />);
    await fillRequiredFields('3-Day Liberia Trip');
    expect(await screen.findByRole('button', { name: /^build my trip$/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^build my trip$/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/trips/itin-2'));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/itineraries');
    expect(url).not.toContain('/preview');
  });
});
