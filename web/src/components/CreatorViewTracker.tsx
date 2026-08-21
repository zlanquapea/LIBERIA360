'use client';

import { useEffect } from 'react';
import { recordCreatorAnalyticsEvent } from '@/lib/analytics-api';

// Creator-profile equivalent of PlaceViewTracker — fires the "view" event
// once per page load. Same reasoning: the public creator profile is a
// server component, so a page view can't be recorded from there directly.
export function CreatorViewTracker({ creatorId }: { creatorId: string }) {
  useEffect(() => {
    recordCreatorAnalyticsEvent(creatorId, 'view');
  }, [creatorId]);

  return null;
}
