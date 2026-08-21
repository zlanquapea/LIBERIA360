'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getMyItineraries, getSharedWithMe } from '@/lib/itinerary-api';
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

      {itineraries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No trips yet — build your first Liberia itinerary.
        </p>
      ) : (
        <TripList itineraries={itineraries} />
      )}

      {shared.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Shared with me</h2>
          <TripList itineraries={shared} />
        </div>
      )}
    </main>
  );
}

function TripList({ itineraries }: { itineraries: Itinerary[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {itineraries.map((itinerary) => (
        <li key={itinerary.id}>
          <Link
            href={`/trips/${itinerary.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:border-brand-500"
          >
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
        </li>
      ))}
    </ul>
  );
}
