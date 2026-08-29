'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { StarIcon } from '@heroicons/react/24/solid';
import { CheckBadgeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { createReview } from '@/lib/reviews-api';
import { HttpError } from '@/lib/http';
import { ReportButton } from './ReportButton';
import type { Review } from '@/lib/types';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="flex shrink-0 items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} aria-hidden className={`h-4 w-4 ${i < rating ? 'text-gold-500' : 'text-slate-300 dark:text-slate-700'}`} />
      ))}
    </span>
  );
}

// Set server-side (ReviewsService.hasConfirmedBooking) when the reviewer
// has a confirmed booking with a business linked to this place — the same
// "verified" signal Amazon (Verified Purchase) and Booking.com (Verified
// stay) surface: not a gate on who can review, just an extra trust signal
// on reviews that have one.
function VerifiedVisitBadge() {
  return (
    <span
      title="This reviewer had a confirmed booking with this listing"
      className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
    >
      <CheckBadgeIcon aria-hidden className="h-3.5 w-3.5" />
      Verified booking
    </span>
  );
}

// Reviews section — used on the Destination Profile screen (Tech Spec
// §3.2 / Business Plan), the Creator public profile, and a car listing's
// detail page, so it takes exactly one of placeId/creatorId/carListingId
// (never more than one — same XOR as CreateReviewInput). Read-only list
// plus, for logged-in users who haven't reviewed this target yet, a form
// to post one. The API enforces one review per user per target (409 on a
// second attempt) — `alreadyReviewed` below is a best-effort local check
// against whatever's loaded, so a stale/duplicate submit still gets a
// clean error message via the 409 branch, not a crash.
export function ReviewsSection({
  placeId,
  creatorId,
  carListingId,
  initialReviews,
}: {
  placeId?: string;
  creatorId?: string;
  carListingId?: string;
  initialReviews: Review[];
}) {
  const { user, token, ready } = useAuth();
  const [reviews, setReviews] = useState(initialReviews);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  const alreadyReviewed = user ? reviews.some((r) => r.user?.id === user.id) : false;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const review = await createReview(token, {
        placeId,
        creatorId,
        carListingId,
        overallRating: rating,
        comment: comment.trim() || undefined,
      });
      setReviews((prev) => [review, ...prev]);
      setComment('');
      setPosted(true);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          No reviews yet — be the first to share your experience.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-medium text-slate-900 dark:text-slate-50">{review.user?.name ?? 'LIBERIA360 user'}</p>
                  {review.verifiedVisit && <VerifiedVisitBadge />}
                </div>
                <Stars rating={review.overallRating} />
              </div>
              {review.comment && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>}
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs text-slate-400 dark:text-slate-400">
                  {new Date(review.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                {review.user?.id !== user?.id && <ReportButton targetType="review" targetId={review.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!ready ? null : !user ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          <Link href="/login" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Log in
          </Link>{' '}
          to write a review.
        </p>
      ) : alreadyReviewed || posted ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          You&apos;ve already reviewed this {creatorId ? 'creator' : carListingId ? 'car' : 'place'}. Thanks for sharing!
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                className={`transition-transform hover:scale-110 ${value <= rating ? 'text-gold-500' : 'text-slate-300 dark:text-slate-700'}`}
              >
                <StarIcon aria-hidden className="h-6 w-6" />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Share your experience (optional)"
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          {error && (
            <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {submitting ? 'Posting…' : 'Post review'}
          </button>
        </form>
      )}
    </div>
  );
}
