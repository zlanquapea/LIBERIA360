'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { EyeIcon, BookmarkIcon, PhoneIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getBusinessAnalytics } from '@/lib/analytics-api';
import { getMyBusinesses } from '@/lib/business-api';
import type { Business, BusinessAnalytics } from '@/lib/types';

// Business analytics dashboard (Tech Spec §3.3 — "views, saves, contact
// clicks, conversion"). Client-only, same reasoning as /trips and
// /account/bookings: JWT auth lives in localStorage. One section per
// claimed business, since an owner can hold more than one listing.
export default function AnalyticsPage() {
  const { user, token, ready } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, BusinessAnalytics>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    getMyBusinesses(token).then(async (myBusinesses) => {
      if (cancelled) return;
      setBusinesses(myBusinesses);
      const entries = await Promise.all(
        myBusinesses.map(async (b) => [b.id, await getBusinessAnalytics(token, b.id)] as const),
      );
      if (!cancelled) {
        setAnalytics(Object.fromEntries(entries));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  if (!ready || loading) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Business Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to see how visitors are finding your listing.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  if (businesses.length === 0) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Business Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Claim a listing to start tracking views, saves, and contact clicks.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Business Analytics</h1>
      {businesses.map((business) => (
        <BusinessAnalyticsSection key={business.id} business={business} analytics={analytics[business.id]} />
      ))}
    </main>
  );
}

function BusinessAnalyticsSection({ business, analytics }: { business: Business; analytics: BusinessAnalytics }) {
  const { totals, byDay } = analytics;
  const maxDayTotal = Math.max(
    1,
    ...byDay.map((d) => d.view + d.save + d.contact_click + d.booking_request),
  );

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">{business.name}</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Views" value={totals.view} icon={EyeIcon} />
        <StatCard label="Saves" value={totals.save} icon={BookmarkIcon} />
        <StatCard label="Contact clicks" value={totals.contact_click} icon={PhoneIcon} />
        <StatCard label="Booking requests" value={totals.booking_request} icon={CalendarDaysIcon} />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">Last 30 days</h3>
        {byDay.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No activity yet in this window.</p>
        ) : (
          <div className="flex h-32 gap-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            {byDay.map((day) => {
              const dayTotal = day.view + day.save + day.contact_click + day.booking_request;
              const heightPct = Math.max(4, Math.round((dayTotal / maxDayTotal) * 100));
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.view} views, ${day.save} saves, ${day.contact_click} contact clicks, ${day.booking_request} booking requests`}
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
    </section>
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
