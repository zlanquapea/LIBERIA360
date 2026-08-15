'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getItinerary } from '@/lib/itinerary-api';
import { HttpError } from '@/lib/http';
import { formatBudgetBand } from '@/lib/format';
import { ItineraryStops } from '@/components/ItineraryStops';
import type { ItineraryDetail } from '@/lib/types';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, token, ready } = useAuth();
  const [itinerary, setItinerary] = useState<ItineraryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    getItinerary(token, id)
      .then((result) => {
        if (!cancelled) setItinerary(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof HttpError ? err.message : 'Could not load this trip.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token, id]);

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
        <p className="text-sm text-slate-500">
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>{' '}
          to view this trip.
        </p>
      </main>
    );
  }

  if (error || !itinerary) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">{error ?? 'Trip not found.'}</p>
        <Link href="/trips" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to My Trips
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <Link href="/trips" className="text-sm font-medium text-brand-700 hover:underline">
          ← My Trips
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{itinerary.title}</h1>
        <p className="text-sm text-slate-500">
          {itinerary.durationDays} day{itinerary.durationDays === 1 ? '' : 's'} · {formatBudgetBand(itinerary.budgetBand)}
          {itinerary.interests.length > 0 && ` · ${itinerary.interests.join(', ')}`}
        </p>
      </div>

      <ItineraryStops stops={itinerary.stops} />
    </main>
  );
}
