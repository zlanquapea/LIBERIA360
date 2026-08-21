'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  deleteEventAdmin,
  deleteReviewAdmin,
  getModerationQueue,
  setBusinessContentReviewStatus,
  setBusinessVerification,
} from '@/lib/admin-api';
import { formatBusinessContentType, formatBusinessContentStatus, formatBusinessType } from '@/lib/format';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import type { BusinessContent, BusinessContentStatus, FlaggedContent, ModerationQueue, VerificationStatus } from '@/lib/types';
import { AdminPageHeader, EmptyState, LoadingState } from '@/components/admin-ui';
import { PlaceReviewPanel } from '../PlaceReviewPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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

  function reload() {
    if (!token) return;
    getModerationQueue(token).then(setQueue);
  }

  useEffect(reload, [token]);

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
          <ul className="flex flex-col gap-3">
            {queue.pendingPlaces.map((place) => (
              <li key={place.id}>
                <PlaceReviewPanel token={token} place={place} onUpdated={reload} />
              </li>
            ))}
          </ul>
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
          <ul className="flex flex-col gap-3">
            {queue.pendingBusinessContent.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-900/20"
              >
                <p className="font-medium text-slate-900 dark:text-slate-50">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatBusinessContentType(item.type)} · {item.business?.name ?? 'Unknown business'}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.body}</p>
                <ContentReviewStatusControl content={item} onDone={reload} />
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
          <ul className="flex flex-col gap-2">
            {queue.flaggedContent.map((flagged) => (
              <FlaggedContentRow key={`${flagged.targetType}-${flagged.targetId}`} flagged={flagged} onDone={reload} />
            ))}
          </ul>
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
