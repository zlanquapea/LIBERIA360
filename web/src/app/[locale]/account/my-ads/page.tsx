'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChartBarIcon, MegaphoneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { deleteAdvertisement, getMyAds } from '@/lib/ads-api';
import { getAdvertisementAnalytics } from '@/lib/analytics-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { formatAdvertisementReviewStatus, formatAdvertisementType } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { AdvertisementForm } from '@/components/AdvertisementForm';
import { BrandLoader } from '@/components/BrandLoader';
import { SafeImage } from '@/components/SafeImage';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SuccessBanner } from '@/components/SuccessBanner';
import type { Advertisement, BusinessAnalytics } from '@/lib/types';

const STATUS_BADGE: Record<Advertisement['reviewStatus'], string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

const STATUS_MESSAGE: Partial<Record<Advertisement['reviewStatus'], string>> = {
  submitted_for_review: "Awaiting admin review — it won't be shown until approved.",
  rejected: 'This ad was rejected. Editing it below resubmits it for review.',
  suspended: 'This ad has been suspended by an admin and is not publicly visible.',
};

// "My Ads" — a self-service marketplace ad slot ("advertise your digital
// product or business"), every status (unlike the public "Sponsored" feed,
// which is approved-only) — mirrors "My Places"/"My Events" exactly.
export default function MyAdsPage() {
  const { user, token, ready } = useAuth();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [metricsId, setMetricsId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<BusinessAnalytics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<Advertisement | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!token) return;
    getMyAds(token)
      .then(setAds)
      .catch((err) => setLoadError(getFriendlyErrorMessage(err, { context: { action: 'load-my-ads' } })))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    reload();
  }, [ready, token, reload]);

  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(id);
  }, [successMessage]);

  async function toggleMetrics(ad: Advertisement) {
    if (metricsId === ad.id) {
      setMetricsId(null);
      setMetrics(null);
      return;
    }
    if (!token) return;
    setMetricsId(ad.id);
    setMetrics(null);
    setMetricsLoading(true);
    try {
      setMetrics(await getAdvertisementAnalytics(token, ad.id));
    } catch {
      setMetricsId(null);
    } finally {
      setMetricsLoading(false);
    }
  }

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    const target = pendingDelete;
    setActionLoading(true);
    setDialogError(null);
    try {
      await deleteAdvertisement(token, target.id);
      setAds((prev) => prev.filter((a) => a.id !== target.id));
      setPendingDelete(null);
      setSuccessMessage(`"${target.title}" was deleted.`);
    } catch (err) {
      if (isNotFoundError(err)) {
        setAds((prev) => prev.filter((a) => a.id !== target.id));
        setPendingDelete(null);
        setSuccessMessage('This ad was already removed.');
      } else {
        setDialogError(getFriendlyErrorMessage(err, { context: { action: 'delete-advertisement', adId: target.id } }));
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Ads</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to advertise your product or business.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Ads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Advertise a digital product or your business — reviewed by our team before it goes live.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            + New ad
          </button>
        )}
      </div>

      {successMessage && <SuccessBanner>{successMessage}</SuccessBanner>}

      {loadError && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError}
        </p>
      )}

      {creating && (
        <AdvertisementForm
          onSaved={(ad) => {
            setAds((prev) => [ad, ...prev]);
            setCreating(false);
            setSuccessMessage('Your ad was submitted for review.');
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {ads.length === 0 && !creating ? (
        <p className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          <MegaphoneIcon aria-hidden className="h-6 w-6 text-slate-400 dark:text-slate-500" />
          You haven&apos;t posted any ads yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ads.map((ad) => (
            <li key={ad.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-start gap-3">
                {ad.images[0] && (
                  <SafeImage
                    src={resolveImageUrl(ad.images[0])}
                    alt={ad.title}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    fallback={<div aria-hidden className="h-16 w-16 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-slate-900 dark:text-slate-50">{ad.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[ad.reviewStatus]}`}>
                      {formatAdvertisementReviewStatus(ad.reviewStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatAdvertisementType(ad.type)}</p>
                </div>
              </div>

              {STATUS_MESSAGE[ad.reviewStatus] && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{STATUS_MESSAGE[ad.reviewStatus]}</p>
              )}
              {ad.reviewStatus === 'rejected' && ad.rejectionReason && (
                <p className="text-xs text-flag-700 dark:text-flag-300">Reviewer note: {ad.rejectionReason}</p>
              )}
              {ad.reviewStatus === 'suspended' && ad.rejectionReason && (
                <p className="text-xs text-flag-700 dark:text-flag-300">Reason: {ad.rejectionReason}</p>
              )}

              {editingId === ad.id ? (
                <AdvertisementForm
                  ad={ad}
                  onSaved={(updated) => {
                    setAds((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
                    setEditingId(null);
                    setSuccessMessage('Changes saved.');
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(ad.id)}
                    className="self-start text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMetrics(ad)}
                    className="flex items-center gap-1 self-start text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                  >
                    <ChartBarIcon aria-hidden className="h-3.5 w-3.5" />
                    {metricsId === ad.id ? 'Hide metrics' : 'View metrics'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(ad)}
                    className="self-start text-xs font-medium text-flag-700 dark:text-flag-300 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}

              {metricsId === ad.id && (
                <div className="flex gap-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  {metricsLoading ? (
                    <span>Loading metrics…</span>
                  ) : metrics ? (
                    <>
                      <span>
                        <strong className="text-slate-900 dark:text-slate-50">{metrics.totals.view}</strong> views
                      </span>
                      <span>
                        <strong className="text-slate-900 dark:text-slate-50">{metrics.totals.contact_click}</strong> contact
                        clicks
                      </span>
                    </>
                  ) : (
                    <span>Couldn&apos;t load metrics.</span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : 'Delete this ad?'}
        description="This removes the ad for good, including its metrics history."
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        isLoading={actionLoading}
        error={dialogError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (actionLoading) return;
          setPendingDelete(null);
          setDialogError(null);
        }}
      />
    </main>
  );
}
