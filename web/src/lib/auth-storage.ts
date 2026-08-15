'use client';

// Phase 2 accounts. Same pattern as saved-places.ts: the JWT + user profile
// live in localStorage (device-scoped, no server session), and every write
// dispatches a same-tab custom event since `storage` only fires cross-tab —
// components like Header's account link need to react immediately after a
// login/logout happens in the same tab.

import type { AuthUser } from './types';

const TOKEN_KEY = 'liberia360:auth-token';
const USER_KEY = 'liberia360:auth-user';
const CHANGE_EVENT = 'liberia360:auth-changed';

export interface StoredAuth {
  token: string;
  user: AuthUser;
}

function readAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage.getItem(TOKEN_KEY);
    const rawUser = window.localStorage.getItem(USER_KEY);
    if (!token || !rawUser) return null;
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    return null;
  }
}

export function getStoredAuth(): StoredAuth | null {
  return readAuth();
}

export function setStoredAuth(auth: StoredAuth): void {
  window.localStorage.setItem(TOKEN_KEY, auth.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearStoredAuth(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToAuth(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
