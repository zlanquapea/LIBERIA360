import { render, waitFor } from '@testing-library/react';
import { AuthRefresher } from './AuthRefresher';
import { clearStoredAuth, getStoredAuth, setStoredAuth } from '@/lib/auth-storage';
import type { AuthUser } from '@/lib/types';

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

describe('AuthRefresher', () => {
  afterEach(() => {
    clearStoredAuth();
    jest.restoreAllMocks();
  });

  it('does nothing when signed out', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<AuthRefresher />);
    await waitFor(() => expect(fetchSpy).not.toHaveBeenCalled());
  });

  it('refreshes the cached user on a successful fetch', async () => {
    setStoredAuth({ token: 'tok', user: { ...USER, isAdmin: false } });
    mockFetchOnce(200, { ...USER, isAdmin: true });

    render(<AuthRefresher />);

    await waitFor(() => expect(getStoredAuth()?.user.isAdmin).toBe(true));
  });

  it('clears the session on a genuine 401 (token no longer valid)', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(401, { message: 'Unauthorized' });

    render(<AuthRefresher />);

    await waitFor(() => expect(getStoredAuth()).toBeNull());
  });

  it('leaves the cached session alone on a transient failure (rate limit, network blip, 5xx)', async () => {
    setStoredAuth({ token: 'tok', user: USER });
    mockFetchOnce(429, { message: 'Too many requests' });

    render(<AuthRefresher />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(getStoredAuth()?.user).toEqual(USER);
  });
});
