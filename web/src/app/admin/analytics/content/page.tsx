'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAggregateAnalytics } from '@/lib/admin-api';
import type { AggregateAnalytics } from '@/lib/types';
import { AdminPageHeader, LoadingState } from '@/components/admin-ui';

// Analytics > Content Performance — which places are getting attention,
// broken down by category and county, not just a single top-5 list. The
// detailed per-place breakdown (views/saves/contact clicks/booking
// requests) formerly lived on the old catch-all "/admin/analytics" page;
// this is its real home in the new IA. Same underlying data as Reports,
// framed for reading rather than exporting.
export default function ContentPerformancePage() {
  const { token } = useAuth();
  const [data, setData] = useState<AggregateAnalytics | null>(null);

  useEffect(() => {
    if (!token) return;
    getAggregateAnalytics(token, 15).then(setData);
  }, [token]);

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader title="Content Performance" description="Engagement by place, category, and county." />

      {!data ? (
        <LoadingState />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Top places by visitor interest</h2>
            {data.topPlaces.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.topPlaces.map((place, i) => (
                  <li key={place.placeId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/places/${place.slug}`}
                        target="_blank"
                        className="font-medium text-slate-900 hover:text-brand-700 dark:text-slate-50"
                      >
                        {i + 1}. {place.name}
                      </Link>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{place.total} events</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {place.views} views · {place.saves} saves · {place.contactClicks} contact clicks ·{' '}
                      {place.bookingRequests} booking requests
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <BreakdownSection title="By category" rows={data.byCategory} />
          <BreakdownSection title="By county" rows={data.byCounty} />
        </>
      )}
    </div>
  );
}

function BreakdownSection({ title, rows }: { title: string; rows: { id: string; name: string; totalEvents: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.totalEvents));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-slate-700 dark:text-slate-200">{row.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.totalEvents / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{row.totalEvents}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
