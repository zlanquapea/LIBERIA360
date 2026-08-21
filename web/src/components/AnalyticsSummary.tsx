import type { ComponentType, SVGProps } from 'react';
import { EyeIcon, BookmarkIcon, PhoneIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import type { AnalyticsTotals, BusinessAnalytics } from '@/lib/types';

type MetricKey = keyof AnalyticsTotals;

const METRIC_CONFIG: Record<MetricKey, { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  view: { label: 'Views', icon: EyeIcon },
  save: { label: 'Saves', icon: BookmarkIcon },
  contact_click: { label: 'Contact clicks', icon: PhoneIcon },
  booking_request: { label: 'Booking requests', icon: CalendarDaysIcon },
};

const ALL_METRICS: MetricKey[] = ['view', 'save', 'contact_click', 'booking_request'];

// Stat cards + a 30-day activity bar chart, shared by the business owner's
// dashboard (all 4 metrics) and the creator dashboard (view/contact_click
// only — creators can't be saved or booked yet, see the [Later phase]
// tasks; showing a permanent "0" for those would misrepresent a feature
// that doesn't exist as a real signal).
export function AnalyticsSummary({
  analytics,
  metrics = ALL_METRICS,
}: {
  analytics: BusinessAnalytics;
  metrics?: MetricKey[];
}) {
  const { totals, byDay } = analytics;
  const dayTotal = (day: BusinessAnalytics['byDay'][number]) => metrics.reduce((sum, key) => sum + day[key], 0);
  const maxDayTotal = Math.max(1, ...byDay.map(dayTotal));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((key) => {
          const { label, icon: Icon } = METRIC_CONFIG[key];
          return <StatCard key={key} label={label} value={totals[key]} icon={Icon} />;
        })}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">Last 30 days</h3>
        {byDay.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No activity yet in this window.</p>
        ) : (
          <div className="flex h-32 gap-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            {byDay.map((day) => {
              const total = dayTotal(day);
              const heightPct = Math.max(4, Math.round((total / maxDayTotal) * 100));
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${metrics.map((key) => `${day[key]} ${METRIC_CONFIG[key].label.toLowerCase()}`).join(', ')}`}
                  // h-full is what actually makes the bar's height:X% below
                  // resolve to something nonzero — a percentage height needs
                  // an ancestor with a defined (not auto/content-sized)
                  // height, and a flex item under `items-end` sizes to its
                  // content by default, not the container's cross-axis size.
                  className="flex h-full w-3 shrink-0 flex-col justify-end"
                >
                  <div className="rounded-t bg-brand-500" style={{ height: `${heightPct}%` }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center shadow-card">
      <Icon aria-hidden className="mx-auto h-5 w-5 text-brand-600" />
      <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
