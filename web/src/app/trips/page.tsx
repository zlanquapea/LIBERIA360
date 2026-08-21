'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { deleteItinerary, getMyItineraries, getSharedWithMe, removeCollaborator } from '@/lib/itinerary-api';
import { HttpError } from '@/lib/http';
import { formatBudgetBand } from '@/lib/format';
import type { Itinerary } from '@/lib/types';

// "My Trips" — saved itineraries from both Build My Liberia Trip and
// Weekend Explorer (Tech Spec §4.3, §3.2). Client-only: the API's JWT
// auth is browser-localStorage-based, not cookies, so there's no way for
// a server component to know who's asking. Trips someone else invited
// this user onto as a collaborator show in their own "Shared with me"
// section rather than mixed into the owned list, so it's always clear
// whose trip it originally was.
export default function TripsPage() {
  const { user, token, ready } = useAuth();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [shared, setShared] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([getMyItineraries(token), getSharedWithMe(token)]).then(([mine, sharedWithMe]) => {
      if (!cancelled) {
        setItineraries(mine);
        setShared(sharedWithMe);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  async function handleDelete(itinerary: Itinerary) {
    if (!token) return;
    if (!confirm(`Delete "${itinerary.title}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteItinerary(token, itinerary.id);
      setItineraries((prev) => prev.filter((t) => t.id !== itinerary.id));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not delete this trip.');
    }
  }

  async function handleLeave(itinerary: Itinerary) {
    if (!token || !user) return;
    if (!confirm(`Leave "${itinerary.title}"? You'll lose access unless you're invited again.`)) return;
    setError(null);
    try {
      await removeCollaborator(token, itinerary.id, user.id);
      setShared((prev) => prev.filter((t) => t.id !== itinerary.id));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not leave this trip.');
    }
  }

  if (!ready || loading) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Trips</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to build and save a Liberia trip.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Trips</h1>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/trips/weekend/new"
            className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
          >
            Weekend Explorer
          </Link>
          <Link
            href="/trips/new"
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            + Build a trip
          </Link>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      {itineraries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No trips yet — build your first Liberia itinerary.
        </p>
      ) : (
        <TripList itineraries={itineraries} actionLabel="Delete trip" onAction={handleDelete} />
      )}

      {shared.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Shared with me</h2>
          <TripList itineraries={shared} actionLabel="Leave trip" onAction={handleLeave} />
        </div>
      )}
    </main>
  );
}

function TripList({
  itineraries,
  actionLabel,
  onAction,
}: {
  itineraries: Itinerary[];
  actionLabel: string;
  onAction: (itinerary: Itinerary) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {itineraries.map((itinerary) => (
        <li
          key={itinerary.id}
          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-brand-500"
        >
          <Link href={`/trips/${itinerary.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900 dark:text-slate-50">{itinerary.title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {itinerary.durationDays} day{itinerary.durationDays === 1 ? '' : 's'} ·{' '}
                {formatBudgetBand(itinerary.budgetBand)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              {itinerary.kind === 'weekend' ? 'Weekend Explorer' : 'Trip'}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => onAction(itinerary)}
            aria-label={`${actionLabel}: ${itinerary.title}`}
            title={actionLabel}
            className="mr-2 shrink-0 rounded-full p-2 text-slate-400 hover:bg-flag-500/10 hover:text-flag-700 dark:hover:text-flag-300"
          >
            <TrashIcon aria-hidden className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}
