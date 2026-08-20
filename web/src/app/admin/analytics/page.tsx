'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAnalyticsOverview, findMetric } from '@/hooks/useAnalyticsOverview';
import { AdminPageHeader, KpiCard, LoadingState, Panel, PeriodToggle } from '@/components/admin-ui';

const METRIC_LABELS: { key: 'newUsers' | 'newReviews' | 'newBookings' | 'pageViews'; label: string }[] = [
  { key: 'newUsers', label: 'New sign-ups' },
  { key: 'newReviews', label: 'New reviews' },
  { key: 'newBookings', label: 'New booking requests' },
  { key: 'pageViews', label: 'Place page views' },
];

// Analytics > Overview — the decision-driving landing page (Tech Spec §3):
// every KPI carries its period-over-period delta and, where one exists,
// a one-line insight, instead of a bare count. "What changed and why does
// it matter" is answered on this one page before an admin drills into
// User/Content/Engagement for more.
export default function AnalyticsOverviewPage() {
  const [days, setDays] = useState(7);
  const overview = useAnalyticsOverview(days);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Analytics Overview"
        description="What's growing, what's declining, and what to look at next."
        action={<PeriodToggle days={days} onChange={setDays} />}
      />

      {!overview ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {METRIC_LABELS.map(({ key, label }) => {
              const m = findMetric(overview, key);
              return (
                <KpiCard
                  key={key}
                  label={label}
                  value={m?.current ?? '—'}
                  direction={m?.direction}
                  deltaPct={m?.deltaPct}
                />
              );
            })}
          </div>

          <Panel title="Insights">
            <ul className="flex flex-col gap-2">
              {overview.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                  {insight}
                </li>
              ))}
            </ul>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Top performers"
              action={
                <Link href="/admin/analytics/content" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
                  Content Performance →
                </Link>
              }
            >
              {overview.topPlaces.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No engagement recorded yet.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {overview.topPlaces.map((p, i) => (
                    <li key={p.placeId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">{i + 1}</span>
                        {p.name}
                      </span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">{p.total}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Needs attention">
              {overview.neglectedPlaces.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Every catalog place got at least one view this period.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {overview.neglectedPlaces.map((p) => (
                    <li key={p.placeId}>
                      <Link
                        href={`/places/${p.slug}`}
                        target="_blank"
                        className="text-sm text-slate-700 hover:text-brand-700 hover:underline dark:text-slate-200"
                      >
                        {p.name}
                      </Link>
                      <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">— zero views</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
