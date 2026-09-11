'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getMyPharmacies, getPharmacyStats, type Pharmacy, type PharmacyStats } from '@/lib/pharmacy-api';
import { BrandLoader } from '@/components/BrandLoader';
import { PharmacyDashboardNav } from '@/components/PharmacyDashboardNav';
import { PharmacyDashboardProvider } from '@/components/PharmacyDashboardContext';

const STATUS_BADGE: Record<Pharmacy['status'], string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Shared shell for every /account/pharmacy-dashboard/[id]/* page — replaces
// the old single ~1200-line page that stacked profile, hours, staff,
// products, and orders top to bottom on one scroll. Everything an owner
// needs for one pharmacy now lives behind one of this shell's tabs, same
// structure as BusinessDashboardLayout for /account/my-businesses/[id].
export default function PharmacyDashboardLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { user, ready } = useAuth();
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [stats, setStats] = useState<PharmacyStats | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    getMyPharmacies().then((list) => {
      const mine = list.find((p) => p.id === id);
      if (mine) {
        setPharmacy(mine);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [id]);

  const reloadStats = useCallback(() => {
    if (!id) return;
    getPharmacyStats(id).then(setStats).catch(() => {
      /* statistics are a nice-to-have — don't block the rest of the dashboard */
    });
  }, [id]);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    reload();
    reloadStats();
  }, [ready, user, reload, reloadStats]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading your pharmacy dashboard…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Pharmacy dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to manage your pharmacy.</p>
        <Link href="/login" className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Log in
        </Link>
      </main>
    );
  }

  if (notFound || !pharmacy) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Pharmacy not found</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This pharmacy doesn&apos;t exist, or isn&apos;t one you manage.
        </p>
        <Link href="/account/pharmacy-dashboard" className="mx-auto text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          ← Back to My Pharmacies
        </Link>
      </main>
    );
  }

  return (
    <PharmacyDashboardProvider value={{ pharmacy, stats, onPharmacyUpdated: setPharmacy, reloadStats }}>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/account/pharmacy-dashboard" className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400">
          <ArrowLeftIcon aria-hidden className="h-4 w-4" /> My Pharmacies
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">Pharmacy</p>
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{pharmacy.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${STATUS_BADGE[pharmacy.status] ?? STATUS_BADGE.pending}`}>
                {formatStatus(pharmacy.status)}
              </span>
            </div>
          </div>
          {pharmacy.status === 'approved' ? (
            <Link
              href={`/pharmacies/${pharmacy.slug}`}
              target="_blank"
              className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              View storefront <ArrowTopRightOnSquareIcon aria-hidden className="h-4 w-4" />
            </Link>
          ) : (
            // one() (the storefront page) only ever resolves an approved
            // pharmacy — a pending/rejected/suspended one 404s, so linking
            // there before then is a dead end.
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {pharmacy.status === 'pending'
                ? 'Storefront available once approved'
                : `Storefront unavailable while ${pharmacy.status}`}
            </span>
          )}
        </header>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          <PharmacyDashboardNav pharmacyId={pharmacy.id} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </PharmacyDashboardProvider>
  );
}
