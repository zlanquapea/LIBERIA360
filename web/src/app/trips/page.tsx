'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getMyItineraries } from '@/lib/itinerary-api';
import { formatBudgetBand } from '@/lib/format';
import type { Itinerary } from '@/lib/types';

// "My Trips" — saved itineraries from both Build My Liberia Trip and
// Weekend Explorer (Tech Spec §4.3, §3.2). Client-only: the API's JWT
// auth is browser-localStorage-based, not cookies, so there's no way for
// a server component to know who's asking.
export default function TripsPage() {
  const { user, token, ready } = useAuth();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    getMyItineraries(token).then((result) => {
      if (!cancelled) {
        setItineraries(result);
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
        <p className="text-sm text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900">My Trips</h1>
        <p className="text-sm text-slate-500">Log in to build and save a Liberia trip.</p>
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
        <h1 className="text-xl font-bold text-slate-900">My Trips</h1>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/trips/weekend/new"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700"
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
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          No trips yet — build your first Liberia itinerary.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {itineraries.map((itinerary) => (
            <li key={itinerary.id}>
              <Link
                href={`/trips/${itinerary.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 hover:border-brand-500"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{itinerary.title}</p>
                  <p className="text-xs text-slate-500">
                    {itinerary.durationDays} day{itinerary.durationDays === 1 ? '' : 's'} ·{' '}
                    {formatBudgetBand(itinerary.budgetBand)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {itinerary.kind === 'weekend' ? 'Weekend Explorer' : 'Trip'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
