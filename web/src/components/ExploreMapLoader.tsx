'use client';

import dynamic from 'next/dynamic';
import type { Category, Place } from '@/lib/types';

// Leaflet touches `window` at import time, so the map must never render on
// the server. `dynamic(..., { ssr: false })` is only valid from inside a
// Client Component in the App Router — this wrapper exists so the server
// component page can stay a plain server component.
const ExploreMapClient = dynamic(() => import('./ExploreMapClient').then((mod) => mod.ExploreMapClient), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-slate-400">Loading map…</div>,
});

export function ExploreMapLoader({ places, categories }: { places: Place[]; categories: Category[] }) {
  return <ExploreMapClient places={places} categories={categories} />;
}
