'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getMyBusinesses } from '@/lib/business-api';
import { formatBusinessReviewStatus, formatBusinessType } from '@/lib/format';
import { VerificationBadge } from '@/components/VerificationBadge';
import { BrandLoader } from '@/components/BrandLoader';
import { BusinessDashboardNav } from '@/components/BusinessDashboardNav';
import { BusinessDashboardProvider } from '@/components/BusinessDashboardContext';
import type { Business } from '@/lib/types';

const REVIEW_BADGE: Record<Business['reviewStatus'], string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

// Shared shell for every /account/my-businesses/[id]/* page — everything
// an owner needs for one business (profile, photos, menu, orders,
// bookings, updates, analytics) lives behind one of this shell's tabs,
// replacing the old scattered layout (edit the profile inline on the
// public place page, incoming bookings on a separate combined page,
// analytics on yet another page). Fetches the business itself
// (getMyBusinesses + find by id) rather than requiring a dedicated
// "GET one business" endpoint — GET /businesses/mine already returns the
// owner's full Business objects regardless of review status.
export default function BusinessDashboardLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { user, token, ready } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!token) return;
    getMyBusinesses(token).then((list) => {
      const mine = list.find((b) => b.id === id);
      if (mine) {
        setBusiness(mine);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [token, id]);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setLoading(false);
      return;
    }
    reload();
  }, [ready, token, reload]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading your business dashboard…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Business dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to manage your business.</p>
        <Link href="/login" className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Log in
        </Link>
      </main>
    );
  }

  if (notFound || !business) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Business not found</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This listing doesn&apos;t exist, or isn&apos;t one you manage.
        </p>
        <Link href="/account/my-businesses" className="mx-auto text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          ← Back to My Businesses
        </Link>
      </main>
    );
  }

  return (
    <BusinessDashboardProvider value={{ business, token, onBusinessUpdated: setBusiness }}>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <Link href="/account/my-businesses" className="flex w-fit items-center gap-1 text-sm text-slate-500 hover:underline dark:text-slate-400">
          <ArrowLeftIcon aria-hidden className="h-4 w-4" /> My Businesses
        </Link>

        <header className="flex flex-wrap items-start justify-between gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
              {formatBusinessType(business.type)}
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{business.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <VerificationBadge status={business.verificationStatus} />
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${REVIEW_BADGE[business.reviewStatus]}`}>
                {formatBusinessReviewStatus(business.reviewStatus)}
              </span>
            </div>
          </div>
          {business.reviewStatus === 'approved' && (
            <Link
              href={`/businesses/${business.slug}`}
              target="_blank"
              className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              View public page <ArrowTopRightOnSquareIcon aria-hidden className="h-4 w-4" />
            </Link>
          )}
        </header>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
          <BusinessDashboardNav business={business} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>
    </BusinessDashboardProvider>
  );
}
