'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createReview } from '@/lib/reviews-api';
import { HttpError } from '@/lib/http';
import type { Review } from '@/lib/types';

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="shrink-0 text-gold-500">
      {'★'.repeat(rating)}
      <span className="text-slate-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

// Reviews section of the Destination Profile screen (Tech Spec §3.2 /
// Business Plan): read-only list plus, for logged-in users who haven't
// reviewed this place yet, a form to post one. The API enforces one review
// per user per place (409 on a second attempt) — `alreadyReviewed` below is
// a best-effort local check against whatever's loaded, so a stale/duplicate
// submit still gets a clean error message via the 409 branch, not a crash.
export function ReviewsSection({ placeId, initialReviews }: { placeId: string; initialReviews: Review[] }) {
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
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
          No reviews yet — be the first to share your experience.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{review.user?.name ?? 'LIBERIA360 user'}</p>
                <Stars rating={review.overallRating} />
              </div>
              {review.comment && <p className="mt-1 text-sm text-slate-600">{review.comment}</p>}
              <p className="mt-1 text-xs text-slate-400">
                {new Date(review.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!ready ? null : !user ? (
        <p className="text-sm text-slate-500">
          <Link href="/login" className="font-medium text-brand-700 hover:underline">
            Log in
          </Link>{' '}
          to write a review.
        </p>
      ) : alreadyReviewed || posted ? (
        <p className="text-sm text-slate-500">You&apos;ve already reviewed this place. Thanks for sharing!</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                className={`text-2xl leading-none ${value <= rating ? 'text-gold-500' : 'text-slate-300'}`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Share your experience (optional)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          {error && (
            <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
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
