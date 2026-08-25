import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TripPlannerForm } from './TripPlannerForm';
import { setStoredAuth, clearStoredAuth } from '@/lib/auth-storage';
import { savePendingTripDraft, takePendingTripDraft } from '@/lib/pending-trip-draft';
import type { AuthUser, Category } from '@/lib/types';

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

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Beaches', slug: 'beaches', description: null, icon: 'SunIcon' },
];

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
  createdAt: '2026-01-01T00:00:00.000Z',
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

    render(<TripPlannerForm categories={CATEGORIES} />);

    expect(screen.getByRole('button', { name: /preview my trip/i })).toBeInTheDocument();
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
      interests: ['beaches'],
      stops: [STOP],
    });

    render(<TripPlannerForm categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole('button', { name: /beaches/i }));
    await userEvent.click(screen.getByRole('button', { name: /preview my trip/i }));
    await screen.findByRole('button', { name: /log in to save this trip/i });

    await userEvent.click(screen.getByRole('button', { name: /log in to save this trip/i }));

    expect(push).toHaveBeenCalledWith('/login?next=/trips/new');
    expect(takePendingTripDraft()).toEqual({
      durationDays: 3,
      budgetBand: 'moderate',
      interests: ['beaches'],
      title: undefined,
    });
  });

  it('auto-saves a resumed draft the instant a returning visitor is signed in', async () => {
    savePendingTripDraft({ durationDays: 5, budgetBand: 'budget', interests: ['beaches'], title: 'My Trip' });
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(201, { id: 'itin-1', title: 'My Trip' });

    render(<TripPlannerForm categories={CATEGORIES} />);

    expect(await screen.findByText(/saving your trip/i)).toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledWith('/trips/itin-1'));

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/itineraries');
    expect(JSON.parse(init.body)).toEqual({
      durationDays: 5,
      budgetBand: 'budget',
      interests: ['beaches'],
      title: 'My Trip',
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

    render(<TripPlannerForm categories={CATEGORIES} />);
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

    render(<TripPlannerForm categories={CATEGORIES} />);
    await userEvent.click(screen.getByRole('button', { name: /use my current location/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/location access was denied/i);
    // Still fully usable without a location — the field is optional.
    expect(screen.getByRole('button', { name: /preview my trip/i })).toBeEnabled();
  });

  it('signed-in visitors with no pending draft still build and save a trip directly', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(201, { id: 'itin-2', title: '3-Day Liberia Trip' });

    render(<TripPlannerForm categories={CATEGORIES} />);
    expect(await screen.findByRole('button', { name: /^build my trip$/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^build my trip$/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/trips/itin-2'));
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/itineraries');
    expect(url).not.toContain('/preview');
  });
});
