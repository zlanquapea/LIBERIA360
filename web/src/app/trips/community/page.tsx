'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPublicTrips } from '@/lib/itinerary-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { PublicTripCard } from '@/components/PublicTripCard';
import type { PublicTripSummary } from '@/lib/types';

// "Trips You Can Join" (Sections 5 & 17 of the Aug 2026 social-trip spec)
// — public trips discoverable by anyone, signed in or not, beyond just
// their creator's own profile. Client-only for the same reason /trips is:
// no server-side auth to key a server component off of, though this page
// itself needs none — GET /itineraries/public is always unauthenticated.
export default function CommunityTripsPage() {
  const [trips, setTrips] = useState<PublicTripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicTrips({ limit: 40 })
      .then((page) => {
        if (!cancelled) setTrips(page.data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getFriendlyErrorMessage(err, { context: { action: 'load-public-trips' } }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Community Trips</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Public trips other travelers are planning — ask to join one, or{' '}
            <Link href="/trips/new" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
              build your own
            </Link>
            .
          </p>
        </div>
        <Link href="/trips" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
          My Trips →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError}
        </p>
      ) : trips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No public trips yet — be the first to make one and invite others to join.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <PublicTripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </main>
  );
}
