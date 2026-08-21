'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { listMyInvitations } from '@/lib/invitations-api';

// Header account affordance — signed out shows "Log in", signed in shows
// the user's initial as a small avatar pill, with a small dot if there's
// an open trip invitation waiting (the in-app half of Section 8's
// notification requirement — there's no general notification center yet,
// so this is deliberately scoped to just invitations for now). Both link
// to /account, which itself decides whether to show the profile or
// redirect to /login.
export function AccountLink() {
  const { user, token, ready } = useAuth();
  const [hasPendingInvitation, setHasPendingInvitation] = useState(false);

  useEffect(() => {
    if (!token) {
      setHasPendingInvitation(false);
      return;
    }
    listMyInvitations(token)
      .then((invitations) => setHasPendingInvitation(invitations.length > 0))
      .catch(() => setHasPendingInvitation(false));
  }, [token]);

  // Before the client-side localStorage check has run, render the
  // signed-out state so server/client markup matches (see useAuth's note).
  if (!ready || !user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:text-brand-300"
      >
        <UserCircleIcon aria-hidden className="h-4 w-4" />
        Log in
      </Link>
    );
  }

  const initial = user.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <Link
      href={hasPendingInvitation ? '/invitations' : '/account'}
      aria-label={
        hasPendingInvitation
          ? `Account — signed in as ${user.name} — you have a pending trip invitation`
          : `Account — signed in as ${user.name}`
      }
      className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105 hover:bg-brand-800"
    >
      {initial}
      {hasPendingInvitation && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-flag-500 dark:border-slate-950"
        />
      )}
    </Link>
  );
}
