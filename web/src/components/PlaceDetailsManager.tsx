'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { formatPlaceReviewStatus } from '@/lib/format';
import { PlaceSubmissionForm } from '@/components/PlaceSubmissionForm';
import type { Place, PlaceReviewStatus } from '@/lib/types';

// The Place Details tab of the business dashboard — everything that used
// to live on the standalone /account/my-places page (name, description,
// category, county/city, location, tags, photos, hours, contact info),
// now folded into the same dashboard as the business-level Profile tab so
// an owner has exactly one place to edit everything about their listing.
// business.linkedPlace is already eager-loaded by GET /businesses/mine, so
// this needs no fetch of its own.

const REVIEW_STATUS_BADGE: Record<PlaceReviewStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  under_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

const REVIEW_STATUS_MESSAGE: Record<Exclude<PlaceReviewStatus, 'approved' | 'draft'>, string> = {
  submitted_for_review: "Awaiting admin review — it won't show publicly until approved.",
  under_review: 'An admin requested changes — see the note below, edit, and it resubmits automatically.',
  rejected: 'This submission was rejected. Editing it below resubmits it for review.',
  suspended: 'This place has been suspended and is not publicly visible.',
};

export function PlaceDetailsManager({
  token,
  place,
  onSaved,
}: {
  token: string;
  place: Place;
  onSaved: (place: Place) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          The destination&apos;s catalog listing — shown in search, on the map, and to travelers browsing{' '}
          {place.category.name.toLowerCase()}.
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_BADGE[place.reviewStatus]}`}>
          {formatPlaceReviewStatus(place.reviewStatus)}
        </span>
      </div>

      {place.reviewStatus !== 'approved' && place.reviewStatus !== 'draft' && (
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <div>
            <p>{REVIEW_STATUS_MESSAGE[place.reviewStatus]}</p>
            {place.rejectionReason && <p className="mt-1 italic">Reviewer note: {place.rejectionReason}</p>}
          </div>
        </div>
      )}

      <PlaceSubmissionForm token={token} place={place} onSaved={onSaved} />
    </div>
  );
}
