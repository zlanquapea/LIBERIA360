'use client';

import { useState } from 'react';
import { useAnalyticsOverview, findMetric } from '@/hooks/useAnalyticsOverview';
import { AdminPageHeader, KpiCard, LoadingState, Panel, PeriodToggle } from '@/components/admin-ui';

// Analytics > Engagement — how people interact with the catalog once
// they're here (views converting to reviews and bookings), and which
// places are earning that engagement.
export default function EngagementPage() {
  const [days, setDays] = useState(7);
  const overview = useAnalyticsOverview(days);
  const pageViews = findMetric(overview, 'pageViews');
  const reviews = findMetric(overview, 'newReviews');
  const bookings = findMetric(overview, 'newBookings');

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Engagement"
        description="How visitors interact with the catalog."
        action={<PeriodToggle days={days} onChange={setDays} />}
      />

      {!overview ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard
              label={`Place views (${days}d)`}
              value={pageViews?.current ?? '—'}
              direction={pageViews?.direction}
              deltaPct={pageViews?.deltaPct}
            />
            <KpiCard
              label="Reviews left"
              value={reviews?.current ?? '—'}
              direction={reviews?.direction}
              deltaPct={reviews?.deltaPct}
              insight={
                pageViews?.current && reviews?.current
                  ? `${((reviews.current / pageViews.current) * 100).toFixed(1)}% of views turned into a review.`
                  : undefined
              }
            />
            <KpiCard
              label="Booking requests"
              value={bookings?.current ?? '—'}
              direction={bookings?.direction}
              deltaPct={bookings?.deltaPct}
              insight={
                pageViews?.current && bookings?.current
                  ? `${((bookings.current / pageViews.current) * 100).toFixed(1)}% of views turned into a booking request.`
                  : undefined
              }
            />
          </div>

          <Panel title="Where the engagement is concentrated">
            {overview.topPlaces.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No activity recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {overview.topPlaces.map((p) => (
                  <li key={p.placeId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-slate-700 dark:text-slate-200">{p.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {p.views} views · {p.saves} saves · {p.contactClicks} contacts · {p.bookingRequests} bookings
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
