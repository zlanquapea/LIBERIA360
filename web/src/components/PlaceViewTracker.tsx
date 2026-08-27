'use client';

import { useEffect } from 'react';
import { recordAnalyticsEvent } from '@/lib/analytics-api';

// Fires the "view" analytics event once per page load (Tech Spec §3.3
// business analytics / §8.4 B2B analytics). Renders nothing — the
// Destination Profile itself is a server component, so a page view can't
// be recorded from there directly.
const RECENT_PLACE_IDS_KEY = 'liberia360_recent_place_ids';

export function PlaceViewTracker({ placeId }: { placeId: string }) {
  useEffect(() => {
    recordAnalyticsEvent(placeId, 'view');

    try {
      const stored = window.localStorage.getItem(RECENT_PLACE_IDS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      const previous = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
      const next = [placeId, ...previous.filter((id) => id !== placeId)].slice(0, 6);
      window.localStorage.setItem(RECENT_PLACE_IDS_KEY, JSON.stringify(next));
    } catch {
      // Private browsing or disabled storage should not block a place view.
    }
  }, [placeId]);

  return null;
}
