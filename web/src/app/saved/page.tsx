'use client';

import { useEffect, useState } from 'react';
import { ApiError, getPlaceBySlug } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { useSavedPlaces } from '@/hooks/useSavedPlaces';
import type { Place } from '@/lib/types';

// Saved / Bucket List screen (Tech Spec §4.1) — reads the device-local
// saved-slugs list and resolves each into full place data from the API.
export default function SavedPage() {
  const { savedSlugs } = useSavedPlaces();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (savedSlugs.length === 0) {
      setPlaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(
      savedSlugs.map((slug) =>
        getPlaceBySlug(slug).catch((error) => {
          // A saved place that's since been removed from the catalog
          // shouldn't crash the whole screen — just drop it from the list.
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }),
      ),
    ).then((results) => {
      if (!cancelled) {
        setPlaces(results.filter((p): p is Place => p !== null));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [savedSlugs]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Saved places</h1>
        <p className="text-sm text-slate-500">Stored on this device — no account needed (Phase 1).</p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : places.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          Nothing saved yet — tap &ldquo;Save&rdquo; on a destination profile to add it here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </main>
  );
}
