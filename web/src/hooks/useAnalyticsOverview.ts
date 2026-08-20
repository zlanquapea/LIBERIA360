'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getAnalyticsOverview } from '@/lib/admin-api';
import type { AnalyticsOverview } from '@/lib/types';

// Shared by every Analytics sub-page (Overview, User Analytics, Content
// Performance, Engagement, Growth & Retention) — they're all different
// framings of the one current-vs-previous-period payload, not separate
// data sources, so they fetch it once each rather than five slightly
// different backend calls.
export function useAnalyticsOverview(days = 7) {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);

  useEffect(() => {
    if (!token) return;
    setOverview(null);
    getAnalyticsOverview(token, days).then(setOverview);
  }, [token, days]);

  return overview;
}

export function findMetric(overview: AnalyticsOverview | null, key: AnalyticsOverview['metrics'][number]['key']) {
  return overview?.metrics.find((m) => m.key === key);
}
