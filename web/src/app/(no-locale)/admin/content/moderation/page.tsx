'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  bulkSetBusinessContentReviewStatus,
  bulkSetPlaceReviewStatus,
  deleteEventAdmin,
  deleteReviewAdmin,
  getModerationQueue,
  setAdvertisementReviewStatus,
  setBusinessContentReviewStatus,
  setBusinessReviewStatus,
  setBusinessVerification,
  setCarListingReviewStatus,
  setEventReviewStatus,
} from '@/lib/admin-api';
import {
  formatAdvertisementReviewStatus,
  formatAdvertisementType,
  formatBusinessContentType,
  formatBusinessContentStatus,
  formatBusinessReviewStatus,
  formatBusinessType,
  formatCarCategory,
  formatCarListingReviewStatus,
  formatCost,
  formatEventCategory,
} from '@/lib/format';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import type {
  Advertisement,
  AdvertisementReviewStatus,
  Business,
  BulkReviewResult,
  BusinessContent,
  BusinessContentStatus,
  BusinessReviewStatus,
  CarListing,
  CarListingReviewStatus,
  Event,
  EventReviewStatus,
  FlaggedContent,
  ModerationQueue,
  VerificationStatus,
} from '@/lib/types';
import { AdminPageHeader, EmptyState, LoadingState } from '@/components/admin-ui';
import { PlaceReviewPanel } from '../PlaceReviewPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdvertisementFullDetails } from '@/components/AdvertisementFullDetails';
import { BusinessFullDetails } from '@/components/BusinessFullDetails';
import { BusinessContentFullDetails } from '@/components/BusinessContentFullDetails';
import { CarListingFullDetails } from '@/components/CarListingFullDetails';

const VERIFICATION_OPTIONS: { value: VerificationStatus; label: string }[] = [
  { value: 'verified', label: 'Verified' },
  { value: 'recommended', label: 'Recommended' },
  { value: 'official', label: 'Official' },
  { value: 'eco_certified', label: 'Eco-certified' },
  { value: 'community_favorite', label: 'Community favorite' },
];

const REASON_LABELS: Record<string, string> = {
  spam: 'spam',
  inappropriate: 'inappropriate',
  fake: 'fake',
  other: 'other',
};

// Content > Moderation — the working queue moved off the dashboard so
// Dashboard could stay a summary/control-center; this is where the
// actual verify/remove actions happen. Any admin (AdminGuard on
// GET /admin/moderation-queue), same as before.
export default function ModerationPage() {
  const { token } = useAuth();
  const [queue, setQueue] = useState<ModerationQueue | null>(null);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [selectedContentIds, setSelectedContentIds] = useState<Set<string>>(new Set());

  function reload() {
    if (!token) return;
    getModerationQueue(token).then(setQueue);
  }

  useEffect(reload, [token]);

  function togglePlace(id: string) {
    setSelectedPlaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleContent(id: string) {
    setSelectedContentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!token) return null;

  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title="Moderation"
        description="Pending business verification and flagged reviews/events."
      />

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Pending places
          {queue && queue.pendingPlaces.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {queue.pendingPlaces.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Places submitted through the public form — invisible everywhere (Near Me, Explore, search) until approved.
        </p>
        {!queue ? (
          <LoadingState />
        ) : queue.pendingPlaces.length === 0 ? (
          <EmptyState title="Nothing pending — the queue is clear." />
        ) : (
          <>
            <BulkReviewBar
              token={token}
              selectedIds={selectedPlaceIds}
              onCleared={() => setSelectedPlaceIds(new Set())}
              onSettled={(failedIds) => setSelectedPlaceIds(new Set(failedIds))}
              bulkApply={bulkSetPlaceReviewStatus}
              onReloaded={reload}
            />
            <ul className="flex flex-col gap-3">
              {queue.pendingPlaces.map((place) => (
                <li key={place.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selectedPlaceIds.has(place.id)}
                    onChange={() => togglePlace(place.id)}
                    aria-label={`Select ${place.name} for bulk action`}
                    className="mt-4 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
                  />
                  <div className="min-w-0 flex-1">
                    <PlaceReviewPanel token={token} place={place} onUpdated={reload} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Pending business claims
          {queue && queue.pendingBusinesses.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {queue.pendingBusinesses.length}
            </span>
          )}
        </h2>
        {!queue ? (
          <LoadingState />
        ) : queue.pendingBusinesses.length === 0 ? (
          <EmptyState title="Nothing pending — the queue is clear." />
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.pendingBusinesses.map((business) => (
              <li
                key={business.id}
                className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <p className="font-medium text-slate-900 dark:text-slate-50">{business.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatBusinessType(business.type)} · owner: {business.owner?.name ?? 'unclaimed'}
                </p>
                <BusinessFullDetails business={business} />
                <BusinessReviewStatusControl business={business} onDone={reload} />
                <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Trust badge (optional, separate from the decision above):</p>
                <VerifyBusinessControl businessId={business.id} onDone={reload} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Pending business content
          {queue && queue.pendingBusinessContent.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {queue.pendingBusinessContent.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Offers, announcements, articles, travel tips &amp; experiences submitted by business owners.
        </p>
        {!queue ? (
          <LoadingState />
        ) : queue.pendingBusinessContent.length === 0 ? (
          <EmptyState title="Nothing pending — the queue is clear." />
        ) : (
          <>
            <BulkReviewBar
              token={token}
              selectedIds={selectedContentIds}
              onCleared={() => setSelectedContentIds(new Set())}
              onSettled={(failedIds) => setSelectedContentIds(new Set(failedIds))}
              bulkApply={bulkSetBusinessContentReviewStatus}
              onReloaded={reload}
            />
            <ul className="flex flex-col gap-3">
              {queue.pendingBusinessContent.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20"
                >
                  <input
                    type="checkbox"
                    checked={selectedContentIds.has(item.id)}
                    onChange={() => toggleContent(item.id)}
                    aria-label={`Select ${item.title} for bulk action`}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-50">{item.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatBusinessContentType(item.type)} · {item.business?.name ?? 'Unknown business'}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                    <BusinessContentFullDetails content={item} />
                    <ContentReviewStatusControl content={item} onDone={reload} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Pending advertisements
          {queue && queue.pendingAdvertisements.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {queue.pendingAdvertisements.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Self-service marketplace ads — invisible on the public &ldquo;Sponsored&rdquo; placements until approved.{' '}
          <Link href="/admin/content?tab=advertisements" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            See every ad, including approved ones you can suspend
          </Link>
          .
        </p>
        {!queue ? (
          <LoadingState />
        ) : queue.pendingAdvertisements.length === 0 ? (
          <EmptyState title="Nothing pending — the queue is clear." />
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.pendingAdvertisements.map((ad) => (
              <li
                key={ad.id}
                className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <p className="font-medium text-slate-900 dark:text-slate-50">{ad.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatAdvertisementType(ad.type)} · {ad.owner?.name ?? 'Unknown'}
                </p>
                <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{ad.description}</p>
                <AdvertisementFullDetails ad={ad} />
                <AdvertisementReviewStatusControl ad={ad} onDone={reload} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Pending car listings
          {queue && queue.pendingCarListings.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {queue.pendingCarListings.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Fleet vehicles from car-rental businesses — invisible on the public /car-rentals directory until approved.{' '}
          <Link href="/admin/content?tab=car-listings" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            See every listing, including approved ones you can suspend
          </Link>
          .
        </p>
        {!queue ? (
          <LoadingState />
        ) : queue.pendingCarListings.length === 0 ? (
          <EmptyState title="Nothing pending — the queue is clear." />
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.pendingCarListings.map((listing) => (
              <li
                key={listing.id}
                className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <p className="font-medium text-slate-900 dark:text-slate-50">{listing.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {listing.year} {listing.make} {listing.model} · {formatCarCategory(listing.category)} ·{' '}
                  {formatCost(listing.pricePerDay)}/day ·{' '}
                  {listing.business?.name ?? listing.owner?.name ?? 'Unknown owner'}
                </p>
                <CarListingFullDetails listing={listing} />
                <CarListingReviewStatusControl listing={listing} onDone={reload} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Pending events
          {queue && queue.pendingEvents.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {queue.pendingEvents.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Self-service event postings — invisible on the public events listing until approved.{' '}
          <Link href="/admin/content?tab=events" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            See every event, including ones you can edit or remove
          </Link>
          .
        </p>
        {!queue ? (
          <LoadingState />
        ) : queue.pendingEvents.length === 0 ? (
          <EmptyState title="Nothing pending — the queue is clear." />
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.pendingEvents.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <Link href={`/events/${event.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                  {event.name}
                </Link>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatEventCategory(event.category)} · {event.county.name} · {event.createdBy?.name ?? 'Unknown'}
                </p>
                {event.description && <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{event.description}</p>}
                <EventReviewStatusControl event={event} onDone={reload} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Flagged content
          {queue && queue.flaggedContent.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              {queue.flaggedContent.length}
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Reviews/events {/* keep in sync with REPORT_FLAG_THRESHOLD */}3+ users independently reported in the last
          90 days.
        </p>
        {!queue ? (
          <LoadingState />
        ) : queue.flaggedContent.length === 0 ? (
          <EmptyState title="Nothing flagged." />
        ) : (
          <FlaggedContentList flaggedContent={queue.flaggedContent} onDone={reload} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Recent reviews</h2>
        {!queue ? (
          <LoadingState />
        ) : queue.recentReviews.length === 0 ? (
          <EmptyState title="No reviews yet." />
        ) : (
          <ul className="flex flex-col gap-2">
            {queue.recentReviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-slate-50">{review.user?.name ?? 'A guest'}</p>
                  <p className="text-slate-500 dark:text-slate-400">{review.overallRating.toFixed(1)} ★</p>
                </div>
                {review.comment && <p className="mt-1 text-slate-600 dark:text-slate-300">{review.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Shared multi-select approve/reject bar for the two queues whose
// single-item action is already a plain approved/rejected review-status
// transition (pending places, pending business content) — the two ids
// AdminService's bulk endpoints operate on. Generic over which endpoint
// it calls so the same bar/UI serves both without duplicating it.
function BulkReviewBar<TStatus extends 'approved' | 'rejected'>({
  token,
  selectedIds,
  bulkApply,
  onReloaded,
  onCleared,
  onSettled,
}: {
  token: string;
  selectedIds: Set<string>;
  bulkApply: (token: string, ids: string[], status: TStatus, reason?: string) => Promise<BulkReviewResult>;
  onReloaded: () => void;
  onCleared: () => void;
  onSettled: (failedIds: string[]) => void;
}) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (selectedIds.size === 0) return null;

  async function apply(status: TStatus, which: 'approve' | 'reject') {
    setAction(which);
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      const result = await bulkApply(token, ids, status, reason.trim() || undefined);
      onSettled(result.failed.map((f) => f.id));
      if (result.failed.length > 0) {
        setError(`${result.failed.length} of ${ids.length} couldn't be updated — still selected so you can retry.`);
      } else {
        setReason('');
        onCleared();
      }
      onReloaded();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'bulk-review-status' } }));
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-brand-700/30 bg-white p-3 shadow-sm dark:border-brand-700/40 dark:bg-slate-900">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{selectedIds.size} selected</span>
      <button
        type="button"
        disabled={action !== null}
        onClick={() => apply('approved' as TStatus, 'approve')}
        className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {action === 'approve' ? 'Approving…' : 'Approve selected'}
      </button>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for rejection (optional)"
        maxLength={1000}
        className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800"
      />
      <button
        type="button"
        disabled={action !== null}
        onClick={() => apply('rejected' as TStatus, 'reject')}
        className="rounded-full border border-flag-600 px-3 py-1.5 text-xs font-semibold text-flag-700 dark:text-flag-300 hover:bg-flag-600 hover:text-white disabled:opacity-60"
      >
        {action === 'reject' ? 'Rejecting…' : 'Reject selected'}
      </button>
      {error && <p className="w-full text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

const BUSINESS_REVIEW_STATUSES: BusinessReviewStatus[] = ['approved', 'under_review', 'rejected', 'suspended'];

// The actual review-lifecycle decision this queue exists for — approve,
// reject, or request changes (under_review) — distinct from
// VerifyBusinessControl below, which only grants a trust badge and never
// touched reviewStatus. Mirrors BusinessesTab's own ReviewStatusControl.
function BusinessReviewStatusControl({ business, onDone }: { business: Business; onDone: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<BusinessReviewStatus>('approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsReason = status === 'rejected' || status === 'under_review' || status === 'suspended';

  async function apply() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await setBusinessReviewStatus(token, business.id, status, reason.trim() || undefined);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'set-business-review-status', businessId: business.id } }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BusinessReviewStatus)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
        >
          {BUSINESS_REVIEW_STATUSES.map((s) => (
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
      </div>
      {needsReason && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason…"
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

function VerifyBusinessControl({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<VerificationStatus>('verified');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await setBusinessVerification(token, businessId, status);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'set-business-verification', businessId } }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as VerificationStatus)}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
      >
        {VERIFICATION_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
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
      {error && <span className="text-xs text-flag-700 dark:text-flag-300">{error}</span>}
    </div>
  );
}

const CONTENT_REVIEW_STATUSES: BusinessContentStatus[] = ['approved', 'rejected'];

// Mirrors ReviewStatusControl (BusinessesTab.tsx) but for BusinessContent's
// smaller lifecycle — no under_review/suspended here (see
// BusinessContentStatus's doc comment), so only approve/reject apply, and
// only reject needs a reason.
function ContentReviewStatusControl({ content, onDone }: { content: BusinessContent; onDone: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<BusinessContentStatus>('approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await setBusinessContentReviewStatus(token, content.id, status, reason.trim() || undefined);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'set-business-content-review-status', contentId: content.id } }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BusinessContentStatus)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
        >
          {CONTENT_REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatBusinessContentStatus(s)}
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
      {status === 'rejected' && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

const ADVERTISEMENT_STATUSES: AdvertisementReviewStatus[] = ['approved', 'rejected'];

// Mirrors ContentReviewStatusControl — but for Advertisement. A pending-queue
// item is always SUBMITTED_FOR_REVIEW, so only approve/reject apply here;
// suspend only makes sense for an already-live ad, which this queue never
// shows (see AdvertisementsTab's fuller ReviewStatusControl for that case).
function AdvertisementReviewStatusControl({ ad, onDone }: { ad: Advertisement; onDone: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<AdvertisementReviewStatus>('approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await setAdvertisementReviewStatus(token, ad.id, status, reason.trim() || undefined);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'set-advertisement-review-status', advertisementId: ad.id } }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as AdvertisementReviewStatus)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
        >
          {ADVERTISEMENT_STATUSES.map((s) => (
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
      {status === 'rejected' && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

const CAR_LISTING_STATUSES: CarListingReviewStatus[] = ['approved', 'rejected'];

// Mirrors AdvertisementReviewStatusControl exactly, for the car-listing
// pending-queue equivalent.
function CarListingReviewStatusControl({ listing, onDone }: { listing: CarListing; onDone: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<CarListingReviewStatus>('approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await setCarListingReviewStatus(token, listing.id, status, reason.trim() || undefined);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'set-car-listing-review-status', carListingId: listing.id } }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as CarListingReviewStatus)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
        >
          {CAR_LISTING_STATUSES.map((s) => (
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
      {status === 'rejected' && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

const EVENT_STATUSES: EventReviewStatus[] = ['approved', 'rejected'];

// Mirrors AdvertisementReviewStatusControl — a pending-queue item is
// always PENDING, so only approve/reject apply here.
function EventReviewStatusControl({ event, onDone }: { event: Event; onDone: () => void }) {
  const { token } = useAuth();
  const [status, setStatus] = useState<EventReviewStatus>('approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await setEventReviewStatus(token, event.id, status, reason.trim() || undefined);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'set-event-review-status', eventId: event.id } }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EventReviewStatus)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
        >
          {EVENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'approved' ? 'Approve' : 'Reject'}
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
      {status === 'rejected' && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}

const FLAGGED_CONTENT_VISIBLE_COUNT = 8;

// Redesign (Sep 3, 2026): this list has no server-side pagination — on a
// busy day it rendered 48 nearly-identical amber rows in one unbroken
// column, turning "Flagged content" into most of the page's scroll and
// making every item look equally urgent by sheer repetition. Collapsing
// to the same "show N, then expand" pattern already used by CountyGrid/
// CategoryGrid keeps the full queue reachable without an admin having to
// scroll past dozens of rows to reach Recent reviews below it.
function FlaggedContentList({ flaggedContent, onDone }: { flaggedContent: FlaggedContent[]; onDone: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? flaggedContent : flaggedContent.slice(0, FLAGGED_CONTENT_VISIBLE_COUNT);
  const hasMore = flaggedContent.length > FLAGGED_CONTENT_VISIBLE_COUNT;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {visible.map((flagged) => (
          <FlaggedContentRow key={`${flagged.targetType}-${flagged.targetId}`} flagged={flagged} onDone={onDone} />
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="self-center rounded-full px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-800"
        >
          {expanded ? 'Show fewer' : `Show all ${flaggedContent.length} flagged items`}
        </button>
      )}
    </div>
  );
}

function FlaggedContentRow({ flagged, onDone }: { flagged: FlaggedContent; onDone: () => void }) {
  const { token } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonSummary = Object.entries(flagged.reasons)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${count} ${REASON_LABELS[reason] ?? reason}`)
    .join(', ');

  async function remove() {
    if (!token) return;
    setRemoving(true);
    setError(null);
    try {
      if (flagged.targetType === 'review') {
        await deleteReviewAdmin(token, flagged.targetId);
      } else {
        await deleteEventAdmin(token, flagged.targetId);
      }
      setConfirming(false);
      onDone();
    } catch (err) {
      if (isNotFoundError(err)) {
        // Already removed (a duplicate report resolved it, or another
        // admin already acted on it).
        setConfirming(false);
        onDone();
      } else {
        setError(
          getFriendlyErrorMessage(err, { context: { action: 'remove-flagged-content', targetId: flagged.targetId } }),
        );
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {flagged.targetType} · {flagged.reportCount} report{flagged.reportCount === 1 ? '' : 's'} ({reasonSummary})
        </p>
        {flagged.review && (
          <>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">
              {flagged.review.user?.name ?? 'A guest'}
            </p>
            {flagged.review.comment && (
              <p className="text-sm text-slate-600 dark:text-slate-300">{flagged.review.comment}</p>
            )}
          </>
        )}
        {flagged.event && (
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">{flagged.event.name}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-full border border-flag-600 px-3 py-1.5 text-xs font-semibold text-flag-700 dark:text-flag-300 hover:bg-flag-600 hover:text-white"
      >
        Remove
      </button>

      <ConfirmDialog
        open={confirming}
        title={`Remove this ${flagged.targetType}?`}
        description={`Reported by ${flagged.reportCount} independent ${flagged.reportCount === 1 ? 'user' : 'users'} (${reasonSummary}). Removing it deletes it permanently.`}
        confirmLabel="Remove"
        loadingLabel="Removing…"
        isLoading={removing}
        error={error}
        onConfirm={remove}
        onCancel={() => {
          if (removing) return;
          setConfirming(false);
          setError(null);
        }}
      />
    </li>
  );
}
