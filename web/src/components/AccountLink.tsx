'use client';

import Link from 'next/link';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';

// Header account affordance — signed out shows "Log in", signed in shows
// the user's initial as a small avatar pill. Used to also carry its own
// small dot for a pending trip invitation (the in-app half of Section 8's
// notification requirement, back when there was no general notification
// center) — that's now NotificationBell's job instead: a pending
// invitation shows there as a virtual entry alongside every other
// notification, so this link goes back to doing one thing, always to
// /account, which itself decides whether to show the profile or redirect
// to /login.
export function AccountLink() {
  const { user, ready } = useAuth();

  // Before the client-side localStorage check has run, render the
  // signed-out state so server/client markup matches (see useAuth's note).
  if (!ready || !user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/5 px-3 py-1.5 text-sm text-white/90 transition-colors hover:border-white hover:bg-white hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        <UserCircleIcon aria-hidden className="h-4 w-4" />
        Log in
      </Link>
    );
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <Link
      href="/account"
      aria-label={`Account — signed in as ${user.name}`}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
    >
      {initial}
    </Link>
  );
}
