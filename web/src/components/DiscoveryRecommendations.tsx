'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRightIcon, ClockIcon, EyeIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { Place } from '@/lib/types';
import { PlaceCardCompact } from './PlaceCardCompact';

const RECENT_PLACE_IDS_KEY = 'liberia360_recent_place_ids';

type DiscoveryRecommendationsProps = {
  places: Place[];
};

/**
 * Lightweight client-side continuation layer. PlaceViewTracker records the
 * IDs of places the visitor actually opened. If the current browser has
 * history, we surface it; otherwise we keep the recommendation section
 * grounded in the real catalog places passed from the server.
 */
export function DiscoveryRecommendations({ places }: DiscoveryRecommendationsProps) {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(RECENT_PLACE_IDS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) setRecentIds(parsed.filter((value): value is string => typeof value === 'string'));
    } catch {
      setRecentIds([]);
    }
  }, []);

  const recent = useMemo(() => {
    const byId = new Map(places.map((place) => [place.id, place]));
    return recentIds.map((id) => byId.get(id)).filter((place): place is Place => Boolean(place)).slice(0, 1);
  }, [places, recentIds]);

  const recommendations = useMemo(() => {
    const recentSet = new Set(recentIds);
    return places.filter((place) => !recentSet.has(place.id)).slice(0, 2);
  }, [places, recentIds]);

  if (places.length === 0) return null;

  return (
    <div className="flex flex-col gap-7">
      {recent.length > 0 && (
        <section aria-labelledby="continue-exploring-heading" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="continue-exploring-heading" className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
                <EyeIcon aria-hidden className="h-5 w-5 text-brand-600 dark:text-brand-300" />
                Continue exploring
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Pick up where you left off.</p>
            </div>
            <Link href="/saved" className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              Saved
              <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.map((place) => (
            <Link
              key={place.id}
              href={`/places/${place.slug}`}
              className="group flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 p-3 transition-colors hover:border-brand-300 dark:border-brand-900 dark:bg-brand-950/25"
            >
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white">
                <ClockIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">Recently viewed</span>
                <span className="mt-0.5 block truncate font-display font-semibold text-slate-900 group-hover:text-brand-700 dark:text-slate-50 dark:group-hover:text-brand-300">{place.name}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{place.city}, {place.county.name}</span>
              </span>
              <ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0 text-brand-700 transition-transform group-hover:translate-x-0.5 dark:text-brand-300" />
            </Link>
          ))}
        </section>
      )}

      {recommendations.length > 0 && (
        <section aria-labelledby="recommended-heading" className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="recommended-heading" className="flex items-center gap-2 font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
                <SparklesIcon aria-hidden className="h-5 w-5 text-gold-500" />
                Recommended for you
              </h2>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Popular places from the current LIBERIA360 catalog.</p>
            </div>
            <Link href="/search?sort=featured" className="flex shrink-0 items-center gap-0.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
              See all
              <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {recommendations.map((place) => (
              <PlaceCardCompact key={place.id} place={place} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
