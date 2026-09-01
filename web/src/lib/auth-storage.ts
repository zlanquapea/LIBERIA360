"use client";

// The session JWT lives only in a Secure, HttpOnly cookie. localStorage holds
// a non-secret profile snapshot for reactive UI rendering, and every write
// dispatches a same-tab custom event since `storage` only fires cross-tab —
// components like Header's account link need to react immediately after a
// login/logout happens in the same tab.

import type { AuthUser } from "./types";

const USER_KEY = "liberia360:auth-user";
const CHANGE_EVENT = "liberia360:auth-changed";

export interface StoredAuth {
  token: string;
  user: AuthUser;
}

function readAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;
  try {
    const rawUser = window.localStorage.getItem(USER_KEY);
    if (!rawUser) return null;
    return { token: "cookie-session", user: JSON.parse(rawUser) as AuthUser };
  } catch {
    return null;
  }
}

export function getStoredAuth(): StoredAuth | null {
  return readAuth();
}

export function setStoredAuth(auth: StoredAuth): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearStoredAuth(): void {
  // Remove the legacy bearer token left by older deployments.
  window.localStorage.removeItem("liberia360:auth-token");
  window.localStorage.removeItem(USER_KEY);
  navigator.serviceWorker?.controller?.postMessage({
    type: "CLEAR_PRIVATE_CACHES",
  });
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToAuth(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
