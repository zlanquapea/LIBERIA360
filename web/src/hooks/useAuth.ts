'use client';

import { useCallback, useEffect, useState } from 'react';
import * as authApi from '@/lib/auth-api';
import type { RegisterInput, UpdateProfileInput } from '@/lib/auth-api';
import { clearStoredAuth, getStoredAuth, setStoredAuth, subscribeToAuth } from '@/lib/auth-storage';
import type { AuthUser } from '@/lib/types';

export function useAuth() {
  // Starts signed-out so server-rendered and first-client-render HTML match
  // (localStorage doesn't exist on the server) — populated in useEffect,
  // same as useSavedPlaces.
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    function sync() {
      const stored = getStoredAuth();
      setUser(stored?.user ?? null);
      setToken(stored?.token ?? null);
    }
    sync();
    setReady(true);
    return subscribeToAuth(sync);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    setStoredAuth({ token: result.accessToken, user: result.user });
    return result.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authApi.register(input);
    setStoredAuth({ token: result.accessToken, user: result.user });
    return result.user;
  }, []);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (!token) throw new Error('Not signed in');
      const updated = await authApi.updateProfile(token, input);
      setStoredAuth({ token, user: updated });
      return updated;
    },
    [token],
  );

  const logout = useCallback(() => {
    clearStoredAuth();
  }, []);

  return { user, token, ready, isAuthenticated: Boolean(token), login, register, updateProfile, logout };
}
