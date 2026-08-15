'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

// Header account affordance — signed out shows "Log in", signed in shows
// the user's initial as a small avatar pill. Both link to /account, which
// itself decides whether to show the profile or redirect to /login.
export function AccountLink() {
  const { user, ready } = useAuth();

  // Before the client-side localStorage check has run, render the
  // signed-out state so server/client markup matches (see useAuth's note).
  if (!ready || !user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-brand-500 hover:text-brand-700"
      >
        <span aria-hidden>👤</span>
        Log in
      </Link>
    );
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <Link
      href="/account"
      aria-label={`Account — signed in as ${user.name}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white hover:bg-brand-800"
    >
      {initial}
    </Link>
  );
}
