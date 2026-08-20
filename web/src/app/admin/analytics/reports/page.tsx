'use client';

import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getAggregateAnalytics } from '@/lib/admin-api';
import { downloadCsv } from '@/lib/csv';
import type { AggregateAnalytics } from '@/lib/types';
import { AdminPageHeader, LoadingState, Panel } from '@/components/admin-ui';

// Analytics > Reports — the B2B aggregate tourism analytics product
// (Business Plan §8.4: "offered to hotels, tour operators, investors,
// government, and NGOs"), plus CSV export so an admin can hand this data
// to one of those stakeholders directly instead of screen-sharing a
// dashboard.
export default function AnalyticsReportsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AggregateAnalytics | null>(null);

  useEffect(() => {
    if (!token) return;
    getAggregateAnalytics(token, 50).then(setData);
  }, [token]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Reports"
        description="Aggregate, anonymized visitor-interest data — exportable for external stakeholders (tour operators, government, NGOs)."
      />

      {!data ? (
        <LoadingState />
      ) : (
        <>
          <Panel
            title="Top places by visitor interest"
            action={
              <ExportButton
                onExport={() =>
                  downloadCsv(
                    'liberia360-top-places.csv',
                    data.topPlaces.map((p) => ({
                      place: p.name,
                      views: p.views,
                      saves: p.saves,
                      contactClicks: p.contactClicks,
                      bookingRequests: p.bookingRequests,
                      total: p.total,
                    })),
                  )
                }
                disabled={data.topPlaces.length === 0}
              />
            }
          >
            {data.topPlaces.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-1.5 pr-3">Place</th>
                      <th className="px-3 py-1.5 text-right">Views</th>
                      <th className="px-3 py-1.5 text-right">Saves</th>
                      <th className="px-3 py-1.5 text-right">Contacts</th>
                      <th className="px-3 py-1.5 text-right">Bookings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.topPlaces.map((p) => (
                      <tr key={p.placeId}>
                        <td className="py-1.5 pr-3 text-slate-800 dark:text-slate-100">{p.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{p.views}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{p.saves}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{p.contactClicks}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{p.bookingRequests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="By category"
              action={
                <ExportButton
                  onExport={() =>
                    downloadCsv(
                      'liberia360-by-category.csv',
                      data.byCategory.map((c) => ({ category: c.name, totalEvents: c.totalEvents })),
                    )
                  }
                  disabled={data.byCategory.length === 0}
                />
              }
            >
              <BreakdownList rows={data.byCategory} />
            </Panel>
            <Panel
              title="By county"
              action={
                <ExportButton
                  onExport={() =>
                    downloadCsv(
                      'liberia360-by-county.csv',
                      data.byCounty.map((c) => ({ county: c.name, totalEvents: c.totalEvents })),
                    )
                  }
                  disabled={data.byCounty.length === 0}
                />
              }
            >
              <BreakdownList rows={data.byCounty} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function ExportButton({ onExport, disabled }: { onExport: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
    >
      <ArrowDownTrayIcon aria-hidden className="h-3.5 w-3.5" />
      Export CSV
    </button>
  );
}

function BreakdownList({ rows }: { rows: { id: string; name: string; totalEvents: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>;
  }
  const max = Math.max(1, ...rows.map((r) => r.totalEvents));
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm text-slate-700 dark:text-slate-200">{row.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.totalEvents / max) * 100}%` }} />
          </div>
          <span className="w-10 shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">{row.totalEvents}</span>
        </li>
      ))}
    </ul>
  );
}
