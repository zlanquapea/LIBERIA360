'use client';

import { useState } from 'react';
import { useAnalyticsOverview, findMetric } from '@/hooks/useAnalyticsOverview';
import { AdminPageHeader, KpiCard, LoadingState, PeriodToggle } from '@/components/admin-ui';

// Analytics > Growth & Retention — the growth half is real (sign-ups,
// same current-vs-previous-period comparison as everywhere else in
// Analytics). Retention is deliberately not faked: a real cohort-
// retention view ("of people who signed up in week 1, how many were
// still active in week 4") needs return-visit history correlated back to
// signup cohort, which this app doesn't collect yet — LoginActivity only
// exists for admin accounts (security oversight), not every visitor. That's
// future work, not something to approximate with a made-up number here.
export default function GrowthPage() {
  const [days, setDays] = useState(7);
  const overview = useAnalyticsOverview(days);
  const signups = findMetric(overview, 'newUsers');

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Growth & Retention"
        description="Sign-up growth trend."
        action={<PeriodToggle days={days} onChange={setDays} />}
      />

      {!overview ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard
            label={`New sign-ups (${days}d)`}
            value={signups?.current ?? '—'}
            direction={signups?.direction}
            deltaPct={signups?.deltaPct}
          />
          <KpiCard label={`Previous ${days}d`} value={signups?.previous ?? '—'} />
        </div>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-200">Retention isn&apos;t measured yet.</p>
        <p className="mt-1">
          A real cohort-retention view (who came back, and when) needs return-visit history tied to each
          person&apos;s sign-up week — the platform doesn&apos;t log that for ordinary visitors today, only admin
          sign-ins (for security oversight). Building it honestly is real backend work, not something to
          approximate with a guessed number here.
        </p>
      </div>
    </div>
  );
}
