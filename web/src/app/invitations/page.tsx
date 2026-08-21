'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { acceptInvitationById, declineInvitationById, listMyInvitations } from '@/lib/invitations-api';
import { HttpError } from '@/lib/http';
import type { MyInvitationSummary } from '@/lib/types';

// "My Invitations" (Section 5): every trip invite currently open for this
// account, reachable directly (no emailed link/token needed) — the
// in-app half of "existing users should receive an in-app notification".
export default function MyInvitationsPage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [invitations, setInvitations] = useState<MyInvitationSummary[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    listMyInvitations(token)
      .then(setInvitations)
      .catch(() => setInvitations([]));
  }, [token]);

  async function handleAccept(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      const trip = await acceptInvitationById(token, id);
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not accept this invitation.');
      setBusyId(null);
    }
  }

  async function handleDecline(id: string) {
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await declineInvitationById(token, id);
      setInvitations((prev) => prev?.filter((i) => i.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not decline this invitation.');
    } finally {
      setBusyId(null);
    }
  }

  if (!ready) return null;

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login?next=/invitations" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
            Log in
          </Link>{' '}
          to see your trip invitations.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Invitations</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Trips other people have invited you to plan together.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      {invitations === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : invitations.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No open invitations right now.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-50">{invitation.tripTitle}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {invitation.destinationSummary} · {invitation.durationDays} day{invitation.durationDays === 1 ? '' : 's'} · Invited by{' '}
                  {invitation.organizerName}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busyId === invitation.id}
                  onClick={() => handleAccept(invitation.id)}
                  className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
                >
                  {busyId === invitation.id ? 'Joining…' : 'Accept'}
                </button>
                <button
                  type="button"
                  disabled={busyId === invitation.id}
                  onClick={() => handleDecline(invitation.id)}
                  className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
