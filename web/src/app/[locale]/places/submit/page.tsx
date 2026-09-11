'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoader } from '@/components/BrandLoader';
import { PlaceSubmissionForm } from '@/components/PlaceSubmissionForm';
import { getMyBusinesses } from '@/lib/business-api';
import { getMyPharmacies } from '@/lib/pharmacy-api';
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
//
// A submission under the dedicated "Pharmacy" category is *also*
// auto-claimed a second time as a Pharmacy (see
// PharmaciesService.autoClaimSubmittedPlace) — a completely separate
// record from the Business one, with its own pending/approved status,
// product catalog, and order queue. Without linking to it here too, the
// only next click this screen offers ("Manage its listing") lands on the
// generic Business dashboard, which has no idea a pharmacy exists at all —
// exactly the "I don't see anything of the pharmacy I created" report this
// was fixed for.
export default function SubmitPlacePage() {
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [submitted, setSubmitted] = useState<Place | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);

  if (!ready) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
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
          {pharmacyId && (
            <Link
              href={`/account/pharmacy-dashboard/${pharmacyId}`}
              className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              Manage your pharmacy
            </Link>
          )}
          <Link
            href={businessId ? `/account/my-businesses/${businessId}` : '/account/my-businesses'}
            className={
              pharmacyId
                ? 'rounded-full border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500'
                : 'rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800'
            }
          >
            {businessId ? 'Manage its listing' : 'Go to My Businesses'}
          </Link>
          <button
            type="button"
            onClick={() => {
              setSubmitted(null);
              setBusinessId(null);
              setPharmacyId(null);
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
          // A submission under the "Pharmacy" category is separately
          // auto-claimed as a Pharmacy too (see PlacesService.submitPlace) —
          // look that up as well so this screen can link straight into its
          // dashboard rather than leaving the pharmacy undiscoverable behind
          // only the generic Business link above.
          getMyPharmacies().then((list) => {
            const match = list.find((p) => p.placeId === place.id);
            if (match) setPharmacyId(match.id);
          });
        }}
      />
    </main>
  );
}
