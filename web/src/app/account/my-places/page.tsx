'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { getMyPlaces } from '@/lib/place-api';
import { formatPlaceReviewStatus, formatPlaceType } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { PlaceSubmissionForm } from '@/components/PlaceSubmissionForm';
import { SafeImage } from '@/components/SafeImage';
import type { Place, PlaceReviewStatus } from '@/lib/types';

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

// "My Places" — a submitter's own destinations regardless of review status
// (getPlaces/getPlaceBySlug are approved-only, so this is the only place a
// pending or rejected submission is visible at all), mirroring the "My
// Bookings"/business-claim pattern already used elsewhere in the account
// area.
export default function MyPlacesPage() {
  const { user, token, ready } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!token) return;
    getMyPlaces(token).then((list) => {
      setPlaces(list);
      setLoading(false);
    });
  }, [token]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    reload();
  }, [ready, token, reload]);

  if (!ready || loading) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Places</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to see places you&apos;ve submitted.</p>
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
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Places</h1>
        <Link
          href="/places/submit"
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + Add a place
        </Link>
      </div>

      {places.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          You haven&apos;t submitted any places yet.{' '}
          <Link href="/places/submit" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Add your first one
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {places.map((place) => (
            <li key={place.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-start gap-3">
                {place.images[0] && (
                  <SafeImage
                    src={resolveImageUrl(place.images[0])}
                    alt={place.name}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    fallback={<div aria-hidden className="h-16 w-16 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {place.reviewStatus === 'approved' ? (
                      <Link href={`/places/${place.slug}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                        {place.name}
                      </Link>
                    ) : (
                      <p className="font-medium text-slate-900 dark:text-slate-50">{place.name}</p>
                    )}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_BADGE[place.reviewStatus]}`}>
                      {formatPlaceReviewStatus(place.reviewStatus)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatPlaceType(place.type)} · {place.city}, {place.county.name}
                  </p>
                </div>
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

              {editingId === place.id ? (
                <PlaceSubmissionForm
                  token={token}
                  place={place}
                  onSaved={(updated) => {
                    setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                    setEditingId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(place.id)}
                  className="self-start text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                >
                  Edit details
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
