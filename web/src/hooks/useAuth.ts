'use client';

import { useCallback, useEffect, useState } from 'react';
import * as authApi from '@/lib/auth-api';
import type { RegisterInput, TwoFactorRequiredResult, UpdateProfileInput } from '@/lib/auth-api';
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

  // Returns the signed-in user directly, or a TwoFactorRequiredResult if
  // the account has 2FA enabled — nothing is stored in that case until
  // verifyTwoFactor succeeds. Callers (LoginPage) branch on the shape.
  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    if ('twoFactorRequired' in result) {
      return result;
    }
    setStoredAuth({ token: result.accessToken, user: result.user });
    return result.user;
  }, []);

  const verifyTwoFactor = useCallback(async (pendingToken: string, code: string) => {
    const result = await authApi.verifyTwoFactor({ pendingToken, code });
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

  const setupTwoFactor = useCallback(async () => {
    if (!token) throw new Error('Not signed in');
    return authApi.setupTwoFactor(token);
  }, [token]);

  const enableTwoFactor = useCallback(
    async (code: string) => {
      if (!token) throw new Error('Not signed in');
      const result = await authApi.enableTwoFactor(token, code);
      // Refresh the cached user so `twoFactorEnabled` flips immediately,
      // instead of waiting for AuthRefresher's next full page load.
      const refreshed = await authApi.fetchMe(token);
      setStoredAuth({ token, user: refreshed });
      return result.recoveryCodes;
    },
    [token],
  );

  const disableTwoFactor = useCallback(
    async (password: string) => {
      if (!token) throw new Error('Not signed in');
      await authApi.disableTwoFactor(token, password);
      const refreshed = await authApi.fetchMe(token);
      setStoredAuth({ token, user: refreshed });
    },
    [token],
  );

  const logout = useCallback(() => {
    clearStoredAuth();
  }, []);

  // No token involved — these three run before/without a session
  // (a signed-out visitor resetting a forgotten password, or clicking a
  // verify-email link from an inbox on another device).
  const forgotPassword = useCallback((email: string) => authApi.forgotPassword(email), []);
  const resetPassword = useCallback(
    (resetToken: string, newPassword: string) => authApi.resetPassword(resetToken, newPassword),
    [],
  );
  const verifyEmail = useCallback((verifyToken: string) => authApi.verifyEmail(verifyToken), []);

  const resendVerification = useCallback(async () => {
    if (!token) throw new Error('Not signed in');
    return authApi.resendVerification(token);
  }, [token]);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!token) throw new Error('Not signed in');
      const result = await authApi.changePassword(token, currentPassword, newPassword);
      setStoredAuth({ token: result.accessToken, user: result.user });
      return result.user;
    },
    [token],
  );

  const logoutAllDevices = useCallback(async () => {
    if (!token) throw new Error('Not signed in');
    const result = await authApi.logoutAllDevices(token);
    setStoredAuth({ token: result.accessToken, user: result.user });
    return result.user;
  }, [token]);

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!token) throw new Error('Not signed in');
      await authApi.deleteAccount(token, password);
      clearStoredAuth();
    },
    [token],
  );

  return {
    user,
    token,
    ready,
    isAuthenticated: Boolean(token),
    login,
    verifyTwoFactor,
    register,
    updateProfile,
    setupTwoFactor,
    enableTwoFactor,
    disableTwoFactor,
    logout,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerification,
    changePassword,
    logoutAllDevices,
    deleteAccount,
  };
}

export type { TwoFactorRequiredResult };
