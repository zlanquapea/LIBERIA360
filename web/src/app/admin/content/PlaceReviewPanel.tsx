'use client';

import { useState } from 'react';
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  MapPinIcon,
  PhoneIcon,
  TagIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { setPlaceReviewStatus } from '@/lib/admin-api';
import { formatCost, formatPlaceReviewStatus, formatPlaceType, formatVisitLength } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { HttpError } from '@/lib/http';
import { SafeImage } from '@/components/SafeImage';
import { inputClass } from './content-shared';
import type { Place, PlaceReviewStatus } from '@/lib/types';

const REVIEW_STATUS_BADGE: Record<PlaceReviewStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// The centerpiece of self-service place submissions: a reviewer needs to
// see exactly what a submitter provided — every photo, the full
// description, contact info, location — before deciding, not just flip a
// verify/unverify switch (that's the separate, pre-existing trust-badge
// workflow — see VerificationBadge). This sits above the regular
// PlaceEditForm on the admin detail view for any place that either isn't
// APPROVED yet or was self-submitted, so a reviewer always has this full
// picture before the plain edit form underneath it.
export function PlaceReviewPanel({
  token,
  place,
  onUpdated,
}: {
  token: string;
  place: Place;
  onUpdated: (place: Place) => void;
}) {
  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState<'reject' | 'under_review' | 'suspend' | null>(null);
  const [submitting, setSubmitting] = useState<PlaceReviewStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: PlaceReviewStatus, decisionReason?: string) {
    setSubmitting(status);
    setError(null);
    try {
      const updated = await setPlaceReviewStatus(token, place.id, status, decisionReason);
      onUpdated(updated);
      setPendingAction(null);
      setReason('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  function submitWithReason(status: 'rejected' | 'under_review' | 'suspended') {
    decide(status, reason.trim() || undefined);
  }

  const hasContact = place.contactPhone || place.whatsapp || place.website || place.instagram || place.facebook;
  const hasCosts = place.estimatedCostEntry != null || place.estimatedCostGuide != null || place.estimatedCostTransport != null;
  const submittedAt = formatDateTime(place.submittedAt);
  const reviewedAt = formatDateTime(place.reviewedAt);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-4 dark:border-amber-800 dark:bg-amber-950/10">
      {/* Header: status + who/when, the context a reviewer needs before anything else */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            📋 Submission review
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_BADGE[place.reviewStatus]}`}>
              {formatPlaceReviewStatus(place.reviewStatus)}
            </span>
          </h3>
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <UserCircleIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {place.owner ? `Submitted by ${place.owner.name} (${place.owner.email})` : 'Added directly by an admin'}
            </span>
            {submittedAt && (
              <span className="flex items-center gap-1.5">
                <CalendarDaysIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                Submitted {submittedAt}
              </span>
            )}
            {reviewedAt && (
              <span className="flex items-center gap-1.5">
                <CalendarDaysIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
                Last reviewed {reviewedAt}
              </span>
            )}
          </div>
        </div>
      </div>

      {place.rejectionReason && (
        <p className="rounded-lg bg-flag-500/10 px-3 py-2 text-xs italic text-flag-700 dark:text-flag-300">
          Reviewer note: {place.rejectionReason}
        </p>
      )}

      {/* The actual submission, laid out like the public destination profile
          so a reviewer sees exactly what a traveler would see if approved —
          not a flat list of raw field values. */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {place.images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {place.images.map((img) => (
              <SafeImage
                key={img}
                src={resolveImageUrl(img)}
                alt={`${place.name} photo`}
                className="h-28 w-40 shrink-0 rounded-lg object-cover"
                fallback={<div aria-hidden className="h-28 w-40 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
              />
            ))}
          </div>
        )}

        <div>
          <p className="text-base font-bold text-slate-900 dark:text-slate-50">{place.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatPlaceType(place.type)} · {place.category.name} · {place.city}, {place.county.name}
          </p>
        </div>

        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{place.description}</p>

        {place.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <TagIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            {place.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        )}

        <a
          href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-fit items-center gap-1.5 text-sm text-brand-700 hover:underline dark:text-brand-300"
        >
          <MapPinIcon aria-hidden className="h-4 w-4 shrink-0" />
          {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)} · Open in Google Maps
        </a>

        {(hasCosts || place.recommendedVisitLength || place.openingHours) && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
            {place.recommendedVisitLength && (
              <div>
                <dt className="text-xs text-slate-400 dark:text-slate-400">Visit length</dt>
                <dd>{formatVisitLength(place.recommendedVisitLength)}</dd>
              </div>
            )}
            {place.estimatedCostEntry != null && (
              <div>
                <dt className="text-xs text-slate-400 dark:text-slate-400">Entry cost</dt>
                <dd>{formatCost(place.estimatedCostEntry)}</dd>
              </div>
            )}
            {place.estimatedCostGuide != null && (
              <div>
                <dt className="text-xs text-slate-400 dark:text-slate-400">Guide cost</dt>
                <dd>{formatCost(place.estimatedCostGuide)}</dd>
              </div>
            )}
            {place.estimatedCostTransport != null && (
              <div>
                <dt className="text-xs text-slate-400 dark:text-slate-400">Transport cost</dt>
                <dd>{formatCost(place.estimatedCostTransport)}</dd>
              </div>
            )}
            {place.openingHours && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs text-slate-400 dark:text-slate-400">Opening hours</dt>
                <dd>{place.openingHours}</dd>
              </div>
            )}
          </dl>
        )}

        {hasContact && (
          <div className="flex flex-wrap gap-2 pt-1">
            {place.contactPhone && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <PhoneIcon aria-hidden className="h-3.5 w-3.5" />
                {place.contactPhone}
              </span>
            )}
            {place.whatsapp && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <ChatBubbleLeftRightIcon aria-hidden className="h-3.5 w-3.5" />
                {place.whatsapp}
              </span>
            )}
            {place.website && (
              <a
                href={place.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1 text-xs text-brand-700 hover:underline dark:border-slate-700 dark:text-brand-300"
              >
                <GlobeAltIcon aria-hidden className="h-3.5 w-3.5" />
                Website
              </a>
            )}
            {place.instagram && (
              <span className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                @{place.instagram}
              </span>
            )}
            {place.facebook && (
              <span className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {place.facebook}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      {/* Contextual decision actions — what makes sense depends on where this
          submission currently is, not one status dropdown covering every
          case at once. */}
      <div className="flex flex-col gap-2">
        {(place.reviewStatus === 'submitted_for_review' || place.reviewStatus === 'under_review') && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => decide('approved')}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting === 'approved' ? 'Approving…' : '✓ Approve & publish'}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => setPendingAction(pendingAction === 'under_review' ? null : 'under_review')}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 hover:text-brand-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:text-brand-300"
            >
              Request changes
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => setPendingAction(pendingAction === 'reject' ? null : 'reject')}
              className="rounded-full border border-flag-600 px-4 py-2 text-sm font-medium text-flag-700 hover:bg-flag-600 hover:text-white disabled:opacity-60 dark:text-flag-300"
            >
              Reject
            </button>
          </div>
        )}

        {place.reviewStatus === 'approved' && place.ownerUserId && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => setPendingAction(pendingAction === 'suspend' ? null : 'suspend')}
            className="self-start rounded-full border border-flag-600 px-4 py-2 text-sm font-medium text-flag-700 hover:bg-flag-600 hover:text-white disabled:opacity-60 dark:text-flag-300"
          >
            Suspend listing
          </button>
        )}

        {place.reviewStatus === 'rejected' && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => decide('approved')}
            className="self-start rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting === 'approved' ? 'Approving…' : 'Reconsider & approve'}
          </button>
        )}

        {place.reviewStatus === 'suspended' && (
          <button
            type="button"
            disabled={submitting !== null}
            onClick={() => decide('approved')}
            className="self-start rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting === 'approved' ? 'Reinstating…' : 'Reinstate & publish'}
          </button>
        )}

        {pendingAction && (
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
              {pendingAction === 'reject' && 'Reason for rejection (shown to the submitter)'}
              {pendingAction === 'under_review' && 'What needs to change (shown to the submitter)'}
              {pendingAction === 'suspend' && 'Reason for suspension'}
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={submitting !== null || (pendingAction === 'reject' && !reason.trim())}
                onClick={() => submitWithReason(pendingAction === 'under_review' ? 'under_review' : pendingAction === 'suspend' ? 'suspended' : 'rejected')}
                className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingAction(null);
                  setReason('');
                }}
                className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
