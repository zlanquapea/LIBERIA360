'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getBusinessAnalytics } from '@/lib/analytics-api';
import { getMyBusinesses } from '@/lib/business-api';
import { AnalyticsSummary } from '@/components/AnalyticsSummary';
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
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">{business.name}</h2>
      <AnalyticsSummary analytics={analytics} />
    </section>
  );
}
