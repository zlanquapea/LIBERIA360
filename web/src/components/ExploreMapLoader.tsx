'use client';

import dynamic from 'next/dynamic';
import type { Category, County, Place } from '@/lib/types';
import { MapFallbackBoundary } from './MapFallbackBoundary';
import { PlaceCard } from './PlaceCard';

// Leaflet touches `window` at import time, so the map must never render on
// the server. `dynamic(..., { ssr: false })` is only valid from inside a
// Client Component in the App Router — this wrapper exists so the server
// component page can stay a plain server component.
const ExploreMapClient = dynamic(() => import('./ExploreMapClient').then((mod) => mod.ExploreMapClient), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-slate-400 dark:text-slate-400">Loading map…</div>,
});

function ExplorePlaceListFallback({ places }: { places: Place[] }) {
  return (
    <div className="h-full w-full overflow-y-auto p-4">
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        The map couldn&apos;t load — here&apos;s the list instead.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {places.map((place, i) => (
          <PlaceCard key={place.id} place={place} index={i} />
        ))}
      </div>
    </div>
  );
}

export function ExploreMapLoader({
  places,
  categories,
  counties,
}: {
  places: Place[];
  categories: Category[];
  counties: County[];
}) {
  return (
    <MapFallbackBoundary fallback={<ExplorePlaceListFallback places={places} />}>
      <ExploreMapClient places={places} categories={categories} counties={counties} />
    </MapFallbackBoundary>
  );
}
