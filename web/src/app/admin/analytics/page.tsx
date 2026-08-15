'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminGate } from '@/components/AdminGate';
import { useAuth } from '@/hooks/useAuth';
import { getAggregateAnalytics } from '@/lib/admin-api';
import type { AggregateAnalytics } from '@/lib/types';

// B2B aggregate tourism analytics (Business Plan §8.4) — "aggregate,
// anonymized insight into search trends and visitor interest ... offered
// to hotels, tour operators, investors, government, and NGOs." Surfaced
// through the admin dashboard rather than a separate external-stakeholder
// account system (see api/src/admin/admin-analytics.service.ts's note on
// why that's out of scope here).
export default function AdminAnalyticsPage() {
  return (
    <AdminGate>
      <AggregateAnalyticsDashboard />
    </AdminGate>
  );
}

function AggregateAnalyticsDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState<AggregateAnalytics | null>(null);

  useEffect(() => {
    if (!token) return;
    getAggregateAnalytics(token, 10).then(setData);
  }, [token]);

  if (!token) return null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">B2B Tourism Analytics</h1>

      {!data ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-slate-800">Top places by visitor interest</h2>
            {data.topPlaces.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.topPlaces.map((place, i) => (
                  <li key={place.placeId} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/places/${place.slug}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {i + 1}. {place.name}
                      </Link>
                      <span className="text-sm font-semibold text-slate-700">{place.total} events</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
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
    </main>
  );
}

function BreakdownSection({ title, rows }: { title: string; rows: { id: string; name: string; totalEvents: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.totalEvents));
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-slate-700">{row.name}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.totalEvents / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs text-slate-500">{row.totalEvents}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
