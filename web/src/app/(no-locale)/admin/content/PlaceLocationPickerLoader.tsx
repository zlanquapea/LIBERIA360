'use client';

import dynamic from 'next/dynamic';

// Leaflet touches `window` at import time — same reason ExploreMapLoader/
// PlaceMiniMapLoader exist — so this must never render on the server.
const PlaceLocationPicker = dynamic(
  () => import('./PlaceLocationPicker').then((mod) => mod.PlaceLocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        Loading map…
      </div>
    ),
  },
);

export function PlaceLocationPickerLoader(props: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  return <PlaceLocationPicker {...props} />;
}
