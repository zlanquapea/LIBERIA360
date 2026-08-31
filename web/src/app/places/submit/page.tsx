'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PlaceSubmissionForm } from '@/components/PlaceSubmissionForm';
import { getMyBusinesses } from '@/lib/business-api';
import type { Place } from '@/lib/types';

// Self-service place submission — anyone signed in can add a destination
// that isn't in the catalog yet, the same fields an admin has via
// CreatePlaceForm. It goes into review, not live immediately (see
// PlaceReviewStatus's doc comment on the backend) — this is the entry
// point. Submitting auto-claims the new place as a Business owned by this
// same user (see BusinessesService.autoClaimSubmittedPlace), synchronously
// within the same request, so the confirmation screen can link straight
// into that business's dashboard — there is no separate "my places" area
// to track it from anymore.
export default function SubmitPlacePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [submitted, setSubmitted] = useState<Place | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  if (!ready) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Add a place</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to submit a new destination to LIBERIA360.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900/40">✓</span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Thanks — {submitted.name} is submitted!</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          An admin will review it soon. It won&apos;t appear in the public catalog until it&apos;s approved.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href={businessId ? `/account/my-businesses/${businessId}` : '/account/my-businesses'}
            className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            {businessId ? 'Manage its listing' : 'Go to My Businesses'}
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(null);
              setBusinessId(null);
            }}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
          >
            Submit another place
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Add a place</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Know a spot that&apos;s missing from LIBERIA360? Add it here — an admin reviews every submission before it goes
          live.
        </p>
      </div>
      <PlaceSubmissionForm
        token={token}
        onSaved={(place) => {
          setSubmitted(place);
          router.refresh();
          // Auto-claim already happened server-side by the time this
          // resolves — find the resulting business so the confirmation
          // screen can deep-link straight into its dashboard.
          getMyBusinesses(token).then((list) => {
            const match = list.find((b) => b.linkedPlaceId === place.id);
            if (match) setBusinessId(match.id);
          });
        }}
      />
    </main>
  );
}
