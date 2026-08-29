'use client';

import { useEffect, useState } from 'react';
import { getAllCarListings, setCarListingReviewStatus } from '@/lib/admin-api';
import { formatCarCategory, formatCarListingReviewStatus, formatCost } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { HttpError } from '@/lib/http';
import { SafeImage } from '@/components/SafeImage';
import { CarListingFullDetails } from '@/components/CarListingFullDetails';
import { inputClass, TabListHeader } from './content-shared';
import type { CarListing, CarListingReviewStatus } from '@/lib/types';

const STATUS_FILTERS: { id: CarListingReviewStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'submitted_for_review', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
];

const STATUS_BADGE: Record<CarListingReviewStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

// Content > Car Rentals — every fleet vehicle regardless of status
// (unlike the public /car-rentals directory, which is approved+active
// only), with the approve/reject/suspend actions the moderation queue's
// "Pending car listings" widget doesn't cover once a listing is already
// live — mirrors AdvertisementsTab's shape exactly.
export function CarListingsTab({ token }: { token: string }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['id']>('all');
  const [listings, setListings] = useState<CarListing[] | null>(null);

  function reload() {
    getAllCarListings(token).then(setListings);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [token]);

  function updateInList(updated: CarListing) {
    setListings((prev) => (prev ? prev.map((l) => (l.id === updated.id ? updated : l)) : prev));
  }

  const filtered = (listings ?? []).filter((listing) => {
    if (statusFilter !== 'all' && listing.reviewStatus !== statusFilter) return false;
    if (search) {
      const haystack =
        `${listing.title} ${listing.make} ${listing.model} ${listing.business?.name ?? ''} ${listing.owner?.name ?? ''}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <TabListHeader title="Car Rentals" count={filtered.length} />

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
        placeholder="Search by title, make/model, or business…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`max-w-sm ${inputClass}`}
      />

      {!listings ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No car listings match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((listing) => (
            <li key={listing.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex flex-wrap items-start gap-3">
                {listing.images[0] && (
                  <SafeImage
                    src={resolveImageUrl(listing.images[0])}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    fallback={<div aria-hidden className="h-12 w-12 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-slate-900 dark:text-slate-50">{listing.title}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {!listing.isActive && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Paused
                        </span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[listing.reviewStatus]}`}>
                        {formatCarListingReviewStatus(listing.reviewStatus)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {listing.year} {listing.make} {listing.model} · {formatCarCategory(listing.category)} ·{' '}
                    {formatCost(listing.pricePerDay)}/day ·{' '}
                    {listing.business?.name ?? listing.owner?.name ?? 'Unknown owner'}
                  </p>
                </div>
              </div>
              {listing.rejectionReason && (
                <p className="text-xs italic text-slate-500 dark:text-slate-400">Note: {listing.rejectionReason}</p>
              )}
              <CarListingFullDetails listing={listing} />
              <ReviewStatusControl token={token} listing={listing} onUpdated={updateInList} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ACTION_STATUSES: CarListingReviewStatus[] = ['approved', 'rejected', 'suspended'];

// One flexible status + optional reason control per row — mirrors
// AdvertisementsTab's ReviewStatusControl.
function ReviewStatusControl({
  token,
  listing,
  onUpdated,
}: {
  token: string;
  listing: CarListing;
  onUpdated: (listing: CarListing) => void;
}) {
  const [status, setStatus] = useState<CarListingReviewStatus>(
    listing.reviewStatus === 'approved' ? 'suspended' : 'approved',
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReason = status === 'rejected' || status === 'suspended';

  async function apply() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await setCarListingReviewStatus(token, listing.id, status, reason.trim() || undefined);
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
          onChange={(e) => setStatus(e.target.value as CarListingReviewStatus)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatCarListingReviewStatus(s)}
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
