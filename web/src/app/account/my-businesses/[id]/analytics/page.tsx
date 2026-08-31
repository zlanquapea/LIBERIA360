'use client';

import { useEffect, useState } from 'react';
import { useBusinessDashboard } from '@/components/BusinessDashboardContext';
import { getBusinessAnalytics } from '@/lib/analytics-api';
import { AnalyticsSummary } from '@/components/AnalyticsSummary';
import type { BusinessAnalytics } from '@/lib/types';

export default function BusinessDashboardAnalyticsPage() {
  const { business, token } = useBusinessDashboard();
  const [analytics, setAnalytics] = useState<BusinessAnalytics | null>(null);

  useEffect(() => {
    getBusinessAnalytics(token, business.id).then(setAnalytics);
  }, [token, business.id]);

  if (!analytics) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading analytics…</p>;
  }

  return <AnalyticsSummary analytics={analytics} />;
}
