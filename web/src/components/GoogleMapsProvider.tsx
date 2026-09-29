'use client';

import type { ReactNode } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_API_KEY } from '@/lib/google-maps';

// Wraps every map on the site. Safe to mount locally in each map component
// rather than once at the root layout — the underlying Maps JavaScript API
// script load is a runtime singleton inside @vis.gl/react-google-maps's own
// APIProvider, so this only loads the script on pages that actually render a
// map, with no duplicate-load risk from multiple instances.
export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-100 p-4 text-center text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        Map unavailable — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.
      </div>
    );
  }

  return <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>{children}</APIProvider>;
}
