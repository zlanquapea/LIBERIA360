'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getMyPharmacies, type Pharmacy } from '@/lib/pharmacy-api';
import { MY_PHARMACIES_ICON } from '@/lib/pharmacy-dashboard-nav';
import { BrandLoader } from '@/components/BrandLoader';

const STATUS_BADGE: Record<Pharmacy['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// The front door into managing a pharmacy — mirrors My Businesses
// (/account/my-businesses): a pharmacy is created the exact same way as
// any other business, by submitting or claiming a place, then goes
// through the same admin place-review as every other business type (see
// PharmaciesService.autoApproveForPlace's doc comment) — there is no
// separate "apply to become a pharmacy" flow or licence-gated approval
// step to offer here anymore. Its products/orders/staff are the
// pharmacy-specific features that come with the "Pharmacy" category, the
// same way a "restaurant"-category business unlocks a Menu.
export default function PharmacyDashboardList() {
  const { user, ready } = useAuth();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !user) {
      if (ready) setLoading(false);
      return;
    }
    getMyPharmacies()
      .then(setPharmacies)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your pharmacies.'))
      .finally(() => setLoading(false));
  }, [ready, user]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Pharmacies</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to manage a pharmacy.</p>
        <Link href="/login" className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Your workspace</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">My Pharmacies</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Profile, products, orders, and staff — everything about a pharmacy lives in its dashboard.
        </p>
      </div>

      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}

      {pharmacies.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <MY_PHARMACIES_ICON aria-hidden className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You don&apos;t manage a pharmacy yet. Add your pharmacy as a place — same as adding any
            other business — and pick <span className="font-semibold">Pharmacy</span> as its
            category. It shows up here automatically once submitted, and goes live the moment an
            admin approves the place.
          </p>
          <Link href="/places/submit" className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Add a place
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {pharmacies.map((p) => (
            <li key={p.id}>
              <Link
                href={`/account/pharmacy-dashboard/${p.id}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-brand-950/20"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <MY_PHARMACIES_ICON aria-hidden className="h-6 w-6 text-slate-400" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold text-slate-950 dark:text-slate-50">{p.name}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_BADGE[p.status] ?? STATUS_BADGE.pending}`}>
                    {formatStatus(p.status)}
                  </span>
                </div>
                <ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
