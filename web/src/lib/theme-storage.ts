'use client';

// Same pattern as auth-storage.ts: a plain localStorage-backed module, not a
// React context — the theme has to be knowable and applied before React even
// hydrates (see the inline script in layout.tsx), so a Provider component
// wrapping the tree wouldn't help with the one thing that actually matters
// here, avoiding a flash of the wrong theme on load.

const STORAGE_KEY = 'liberia360:theme';
const CHANGE_EVENT = 'liberia360:theme-changed';

export type Theme = 'light' | 'dark';

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// The user's explicit choice, or null if they've never toggled it (falls
// back to OS preference every time, so it keeps following the system until
// they actually state an opinion).
export function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === 'dark' || raw === 'light' ? raw : null;
  } catch {
    return null;
  }
}

export function getResolvedTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return getStoredTheme() ?? (prefersDark() ? 'dark' : 'light');
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function setStoredTheme(theme: Theme): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeToTheme(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}
