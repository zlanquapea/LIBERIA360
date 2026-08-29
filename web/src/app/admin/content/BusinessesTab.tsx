'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listBusinessesAdmin, setBusinessReviewStatus, setBusinessVerification } from '@/lib/admin-api';
import { formatBusinessReviewStatus, formatBusinessType } from '@/lib/format';
import { HttpError } from '@/lib/http';
import { inputClass, TabListHeader } from './content-shared';
import { VerificationBadge } from '@/components/VerificationBadge';
import { BusinessFullDetails } from '@/components/BusinessFullDetails';
import type { Business, BusinessReviewStatus, VerificationStatus } from '@/lib/types';

const PAGE_SIZE = 20;

const STATUS_FILTERS: { id: BusinessReviewStatus | 'all' | 'reported'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'submitted_for_review', label: 'Pending' },
  { id: 'under_review', label: 'Under review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'reported', label: 'Reported' },
];

const REVIEW_STATUS_BADGE: Record<BusinessReviewStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

const VERIFICATION_OPTIONS: { id: VerificationStatus; label: string }[] = [
  { id: 'unverified', label: 'No badge' },
  { id: 'verified', label: 'Verified' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'official', label: 'Official' },
  { id: 'eco_certified', label: 'Eco Certified' },
  { id: 'community_favorite', label: 'Community Favorite' },
];

// Content > Businesses — the "Business Management" area: every business
// regardless of review status (unlike the public directory), with the
// review-lifecycle actions (approve/reject/request changes/suspend) an
// admin needs. The pre-existing "Pending business claims" widget on the
// Moderation page still works (same underlying data, still true after
// the review-lifecycle change), but this is the fuller surface — search,
// every status including reported, one place instead of only pending.
export function BusinessesTab({ token }: { token: string }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['id']>('all');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ data: Business[]; meta: { total: number; totalPages: number } } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  function reload() {
    listBusinessesAdmin(token, {
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      reviewStatus: statusFilter !== 'all' && statusFilter !== 'reported' ? statusFilter : undefined,
      reportedOnly: statusFilter === 'reported',
    }).then(setResult);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reload, [page, debouncedSearch, statusFilter]);

  function updateInList(updated: Business) {
    setResult((prev) => (prev ? { ...prev, data: prev.data.map((b) => (b.id === updated.id ? updated : b)) } : prev));
  }

  return (
    <div className="flex flex-col gap-4">
      <TabListHeader title="Businesses" count={result?.meta.total ?? 0} />

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
        placeholder="Search by name or description…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={`max-w-sm ${inputClass}`}
      />

      {!result ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No businesses match this filter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.data.map((business) => (
            <li key={business.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-slate-50">
                    {business.reviewStatus === 'approved' ? (
                      <Link href={`/businesses/${business.slug}`} className="hover:underline">
                        {business.name}
                      </Link>
                    ) : (
                      business.name
                    )}
                    <VerificationBadge status={business.verificationStatus} />
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatBusinessType(business.type)} · {business.linkedPlace.city}, {business.linkedPlace.county.name} ·{' '}
                    {business.owner ? business.owner.name : 'Unclaimed'}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_BADGE[business.reviewStatus]}`}>
                  {formatBusinessReviewStatus(business.reviewStatus)}
                </span>
              </div>
              {business.rejectionReason && (
                <p className="text-xs italic text-slate-500 dark:text-slate-400">Note: {business.rejectionReason}</p>
              )}
              <BusinessFullDetails business={business} />
              <ReviewStatusControl token={token} business={business} onUpdated={updateInList} />
              <VerificationControl token={token} business={business} onUpdated={updateInList} />
            </li>
          ))}
        </ul>
      )}

      {result && result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:pointer-events-none disabled:text-slate-300 dark:disabled:text-slate-700"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {page} of {result.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:pointer-events-none disabled:text-slate-300 dark:disabled:text-slate-700"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const ACTION_STATUSES: BusinessReviewStatus[] = ['approved', 'under_review', 'rejected', 'suspended'];

// One flexible status + optional reason control per row — mirrors
// VerifyBusinessControl's shape (moderation/page.tsx) but for the
// separate review lifecycle: approve/request changes (under_review)/
// reject/suspend, each with an optional reason that becomes rejection
// reason, reviewer guidance, or a suspension note depending on the status
// picked (see BusinessReviewStatus's doc comment on the backend).
function ReviewStatusControl({
  token,
  business,
  onUpdated,
}: {
  token: string;
  business: Business;
  onUpdated: (business: Business) => void;
}) {
  const [status, setStatus] = useState<BusinessReviewStatus>(
    business.reviewStatus === 'approved' ? 'suspended' : 'approved',
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReason = status === 'rejected' || status === 'under_review' || status === 'suspended';

  async function apply() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await setBusinessReviewStatus(token, business.id, status, reason.trim() || undefined);
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
          onChange={(e) => setStatus(e.target.value as BusinessReviewStatus)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {ACTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatBusinessReviewStatus(s)}
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
        <Link
          href="/admin/content/moderation"
          className="text-xs text-slate-400 dark:text-slate-400 hover:text-flag-700 dark:hover:text-flag-300 hover:underline"
        >
          See reports
        </Link>
      </div>
      {needsReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={status === 'rejected' ? 'Reason for rejection…' : status === 'suspended' ? 'Reason for suspension…' : 'What needs to change…'}
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}


function VerificationControl({
  token,
  business,
  onUpdated,
}: {
  token: string;
  business: Business;
  onUpdated: (business: Business) => void;
}) {
  const [status, setStatus] = useState<VerificationStatus>(business.verificationStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (status === business.verificationStatus) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await setBusinessVerification(token, business.id, status);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
      <label className="text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor={`verification-${business.id}`}>
        Public badge
      </label>
      <select
        id={`verification-${business.id}`}
        aria-label={`Public verification badge for ${business.name}`}
        value={status}
        onChange={(e) => setStatus(e.target.value as VerificationStatus)}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {VERIFICATION_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={submitting || status === business.verificationStatus}
        onClick={apply}
        className="rounded-full border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-950/30 dark:disabled:border-slate-700 dark:disabled:text-slate-600"
      >
        {submitting ? 'Saving…' : 'Save badge'}
      </button>
      {error && <p role="alert" className="basis-full text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}
