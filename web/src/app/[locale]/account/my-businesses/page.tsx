'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRightIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getMyBusinesses } from '@/lib/business-api';
import { formatBusinessReviewStatus, formatBusinessType } from '@/lib/format';
import { VerificationBadge } from '@/components/VerificationBadge';
import { resolveImageUrl } from '@/lib/images';
import { BrandLoader } from '@/components/BrandLoader';
import { SafeImage } from '@/components/SafeImage';
import type { Business } from '@/lib/types';

const REVIEW_BADGE: Record<Business['reviewStatus'], string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

// The single, obvious front door into managing a claimed business — one
// click from the account hub, listing every business the signed-in user
// manages, each opening straight into its own dashboard
// (/account/my-businesses/[id]). Replaces "find the place on the public
// site and scroll to the claim section" as the only way in.
export default function MyBusinessesPage() {
  const { user, token, ready } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    getMyBusinesses(token)
      .then(setBusinesses)
      .finally(() => setLoading(false));
  }, [ready, token]);

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
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Businesses</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to manage a claimed business.</p>
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
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">My Businesses</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Everything about a claimed business — profile, menu, orders, bookings, updates, analytics — lives in its dashboard.
        </p>
      </div>

      {businesses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <BuildingStorefrontIcon aria-hidden className="h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You haven&apos;t claimed a business yet. Find your place&apos;s page and claim it to start managing it here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {businesses.map((business) => (
            <li key={business.id}>
              <Link
                href={`/account/my-businesses/${business.id}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-brand-950/20"
              >
                <SafeImage
                  src={business.logoImage ? resolveImageUrl(business.logoImage) : business.images[0] ? resolveImageUrl(business.images[0]) : null}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  fallback={
                    <div aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      <BuildingStorefrontIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-bold text-slate-950 dark:text-slate-50">{business.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatBusinessType(business.type)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <VerificationBadge status={business.verificationStatus} />
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${REVIEW_BADGE[business.reviewStatus]}`}>
                      {formatBusinessReviewStatus(business.reviewStatus)}
                    </span>
                  </div>
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
