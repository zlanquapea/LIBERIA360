'use client';

import { useEffect } from 'react';
import { recordAnalyticsEvent } from '@/lib/analytics-api';

// Fires the "view" analytics event once per page load (Tech Spec §3.3
// business analytics / §8.4 B2B analytics). Renders nothing — the
// Destination Profile itself is a server component, so a page view can't
// be recorded from there directly.
export function PlaceViewTracker({ placeId }: { placeId: string }) {
  useEffect(() => {
    recordAnalyticsEvent(placeId, 'view');
  }, [placeId]);

  return null;
}
