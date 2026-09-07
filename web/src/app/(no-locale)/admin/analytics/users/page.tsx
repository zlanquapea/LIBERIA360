'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAnalyticsOverview, findMetric } from '@/hooks/useAnalyticsOverview';
import { AdminPageHeader, KpiCard, LoadingState, Panel, PeriodToggle } from '@/components/admin-ui';

// Analytics > User Analytics — sign-up trend plus who's actually
// engaging (most active reviewers, the one per-user engagement signal
// this app tracks by name — page views are anonymous by design, see
// AnalyticsEvent's doc comment, so they can't be attributed to a user).
export default function UserAnalyticsPage() {
  const [days, setDays] = useState(7);
  const overview = useAnalyticsOverview(days);
  const signups = findMetric(overview, 'newUsers');

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="User Analytics"
        description="Sign-up trend and who's most engaged."
        action={<PeriodToggle days={days} onChange={setDays} />}
      />

      {!overview ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard
              label={`New sign-ups (${days}d)`}
              value={signups?.current ?? '—'}
              direction={signups?.direction}
              deltaPct={signups?.deltaPct}
              insight={
                signups?.direction === 'up'
                  ? 'Growth is accelerating.'
                  : signups?.direction === 'down'
                    ? 'Sign-ups slowed this period.'
                    : undefined
              }
            />
            <KpiCard label="Previous period" value={signups?.previous ?? '—'} />
          </div>

          <Panel
            title="Most active reviewers this period"
            action={
              <Link href="/admin/users" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                All users →
              </Link>
            }
          >
            {overview.topReviewers.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No reviews recorded in this period yet.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {overview.topReviewers.map((reviewer, i) => (
                  <li key={reviewer.userId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                      <span className="text-xs font-semibold text-slate-400 dark:text-slate-400">{i + 1}</span>
                      {reviewer.name}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                      {reviewer.reviewCount} review{reviewer.reviewCount === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
