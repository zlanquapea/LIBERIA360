'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { ItineraryStopDetail } from '@/lib/types';
import { MapFallbackBoundary } from './MapFallbackBoundary';

// Same reasoning as ExploreMapLoading: a named component (not an inline
// arrow) so it can call useTranslations() — dynamic()'s `loading` option is
// still rendered as a component, hooks included, but only if it's
// addressable as one.
function TripMapLoading() {
  const t = useTranslations('trips');
  return (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400 dark:text-slate-400">
      {t('tripMapLoading')}
    </div>
  );
}

// Leaflet touches `window` at import time, so the map must never render on
// the server — see ExploreMapLoader's own comment on the same pattern.
const TripMapClient = dynamic(() => import('./TripMapClient').then((mod) => mod.TripMapClient), {
  ssr: false,
  loading: TripMapLoading,
});

function TripMapFallback() {
  const t = useTranslations('trips');
  return (
    <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-slate-400 dark:text-slate-400">
      {t('tripMapUnavailable')}
    </div>
  );
}

export function TripMapLoader({ stops }: { stops: ItineraryStopDetail[] }) {
  return (
    <MapFallbackBoundary fallback={<TripMapFallback />}>
      <TripMapClient stops={stops} />
    </MapFallbackBoundary>
  );
}
