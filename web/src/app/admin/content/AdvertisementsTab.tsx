'use client';

import { useEffect, useState } from 'react';
import { getAllAdvertisements, setAdvertisementReviewStatus } from '@/lib/admin-api';
import { formatAdvertisementReviewStatus, formatAdvertisementType } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { HttpError } from '@/lib/http';
import { SafeImage } from '@/components/SafeImage';
import { AdvertisementFullDetails } from '@/components/AdvertisementFullDetails';
import { inputClass, TabListHeader } from './content-shared';
import type { Advertisement, AdvertisementReviewStatus } from '@/lib/types';

const STATUS_FILTERS: { id: AdvertisementReviewStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'submitted_for_review', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
];

const STATUS_BADGE: Record<AdvertisementReviewStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

// Content > Advertisements — every self-service ad regardless of status
// (unlike the public "Sponsored" feed, which is approved-only), with the
// approve/reject/suspend actions the moderation queue's "Pending
// advertisements" widget doesn't cover once an ad is already live —
// mirrors BusinessesTab's shape exactly.
export function AdvertisementsTab({ token }: { token: string }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['id']>('all');
  const [ads, setAds] = useState<Advertisement[] | null>(null);

  function reload() {
    getAllAdvertisements(token).then(setAds);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [token]);

  function updateInList(updated: Advertisement) {
    setAds((prev) => (prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev));
  }

  const filtered = (ads ?? []).filter((ad) => {
    if (statusFilter !== 'all' && ad.reviewStatus !== statusFilter) return false;
    if (search && !ad.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <TabListHeader title="Advertisements" count={filtered.length} />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            aria-pressed={statusFilter === f.id}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              statusFilter === f.id
                ? 'border-transparent bg-brand-700 text-white'
                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <input
        placeholder="Search by title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`max-w-sm ${inputClass}`}
      />

      {!ads ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No advertisements match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((ad) => (
            <li key={ad.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex flex-wrap items-start gap-3">
                {ad.images[0] && (
                  <SafeImage
                    src={resolveImageUrl(ad.images[0])}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    fallback={<div aria-hidden className="h-12 w-12 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-50">{ad.title}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[ad.reviewStatus]}`}>
                      {formatAdvertisementReviewStatus(ad.reviewStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatAdvertisementType(ad.type)} · {ad.owner?.name ?? 'Unknown'}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{ad.description}</p>
                </div>
              </div>
              {ad.rejectionReason && (
                <p className="text-xs italic text-slate-500 dark:text-slate-400">Note: {ad.rejectionReason}</p>
              )}
              <AdvertisementFullDetails ad={ad} />
              <ReviewStatusControl token={token} ad={ad} onUpdated={updateInList} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ACTION_STATUSES: AdvertisementReviewStatus[] = ['approved', 'rejected', 'suspended'];

// One flexible status + optional reason control per row — mirrors
// BusinessesTab's ReviewStatusControl for the Advertisement equivalent:
// approve/reject/suspend, each with an optional reason that becomes the
// rejection or suspension note (see AdvertisementReviewStatus's doc
// comment on the backend).
function ReviewStatusControl({
  token,
  ad,
  onUpdated,
}: {
  token: string;
  ad: Advertisement;
  onUpdated: (ad: Advertisement) => void;
}) {
  const [status, setStatus] = useState<AdvertisementReviewStatus>(ad.reviewStatus === 'approved' ? 'suspended' : 'approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReason = status === 'rejected' || status === 'suspended';

  async function apply() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await setAdvertisementReviewStatus(token, ad.id, status, reason.trim() || undefined);
      onUpdated(updated);
      setReason('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AdvertisementReviewStatus)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatAdvertisementReviewStatus(s)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={submitting}
          onClick={apply}
          className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Applying…' : 'Apply'}
        </button>
      </div>
      {needsReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={status === 'rejected' ? 'Reason for rejection…' : 'Reason for suspension…'}
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}
