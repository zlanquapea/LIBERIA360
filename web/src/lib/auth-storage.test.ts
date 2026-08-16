import { clearStoredAuth, getStoredAuth, setStoredAuth, subscribeToAuth } from './auth-storage';
import type { AuthUser } from './types';

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

describe('auth-storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredAuth()).toBeNull();
  });

  it('round-trips token + user through setStoredAuth/getStoredAuth', () => {
    setStoredAuth({ token: 'jwt-token', user: USER });
    expect(getStoredAuth()).toEqual({ token: 'jwt-token', user: USER });
  });

  it('clearStoredAuth removes both and getStoredAuth goes back to null', () => {
    setStoredAuth({ token: 'jwt-token', user: USER });
    clearStoredAuth();
    expect(getStoredAuth()).toBeNull();
  });

  it('returns null if only one of token/user is present (partial/corrupt state)', () => {
    window.localStorage.setItem('liberia360:auth-token', 'jwt-token');
    // liberia360:auth-user deliberately left unset.
    expect(getStoredAuth()).toBeNull();
  });

  it('returns null instead of throwing if the stored user JSON is corrupt', () => {
    window.localStorage.setItem('liberia360:auth-token', 'jwt-token');
    window.localStorage.setItem('liberia360:auth-user', '{not valid json');
    expect(getStoredAuth()).toBeNull();
  });

  it('notifies same-tab subscribers on set and on clear', () => {
    const callback = jest.fn();
    const unsubscribe = subscribeToAuth(callback);

    setStoredAuth({ token: 'jwt-token', user: USER });
    expect(callback).toHaveBeenCalledTimes(1);

    clearStoredAuth();
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    setStoredAuth({ token: 'jwt-token', user: USER });
    expect(callback).toHaveBeenCalledTimes(2); // no further calls once unsubscribed
  });
});
