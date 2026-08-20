'use client';

import { useEffect, useState } from 'react';
import { ApiError, getPlaceBySlug } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { useSavedPlaces } from '@/hooks/useSavedPlaces';
import { cachePlaceSnapshot, getCachedPlaceSnapshot } from '@/lib/saved-places';
import type { Place } from '@/lib/types';

interface ResolvedPlace {
  place: Place;
  offline: boolean;
}

// Saved / Bucket List screen (Tech Spec §4.1) — reads the device-local
// saved-slugs list and resolves each into full place data from the API.
// Offline-capable (§6.3): a place that fails to load for any reason other
// than a 404 (removed from the catalog) falls back to the last snapshot
// cached the previous time it loaded successfully — see lib/saved-places.ts.
export default function SavedPage() {
  const { savedSlugs } = useSavedPlaces();
  const [resolved, setResolved] = useState<ResolvedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (savedSlugs.length === 0) {
      setResolved([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(
      savedSlugs.map(async (slug): Promise<ResolvedPlace | null> => {
        try {
          const place = await getPlaceBySlug(slug);
          cachePlaceSnapshot(place);
          return { place, offline: false };
        } catch (error) {
          // A saved place that's since been removed from the catalog
          // shouldn't crash the whole screen — just drop it from the list.
          if (error instanceof ApiError && error.status === 404) return null;
          // Any other failure — most commonly no network at all — falls
          // back to the last snapshot cached for this place, if any.
          const cached = getCachedPlaceSnapshot(slug);
          return cached ? { place: cached.place, offline: true } : null;
        }
      }),
    ).then((results) => {
      if (!cancelled) {
        setResolved(results.filter((r): r is ResolvedPlace => r !== null));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [savedSlugs]);

  const anyOffline = resolved.some((r) => r.offline);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Saved places</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Stored on this device — no account needed (Phase 1).</p>
      </div>

      {anyOffline && (
        <p className="rounded-xl bg-amber-50 dark:bg-amber-900/30 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
          You&apos;re offline — showing the last saved copy for some places. Details may be out of date.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : resolved.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          Nothing saved yet — tap &ldquo;Save&rdquo; on a destination profile to add it here.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {resolved.map(({ place, offline }) => (
            <div key={place.id} className="relative">
              {offline && (
                <span className="absolute right-2 top-2 z-10 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
                  Offline copy
                </span>
              )}
              <PlaceCard place={place} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
