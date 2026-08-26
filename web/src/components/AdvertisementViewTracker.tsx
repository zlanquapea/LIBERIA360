'use client';

import { useEffect } from 'react';
import { recordAdvertisementAnalyticsEvent } from '@/lib/analytics-api';

// Fires the "view" analytics event once per page load — mirrors
// PlaceViewTracker. The ad detail page itself is a server component, so a
// page view can't be recorded from there directly.
export function AdvertisementViewTracker({ advertisementId }: { advertisementId: string }) {
  useEffect(() => {
    recordAdvertisementAnalyticsEvent(advertisementId, 'view');
  }, [advertisementId]);

  return null;
}
