'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { TruckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getCounties } from '@/lib/api';
import { getMyBusinesses } from '@/lib/business-api';
import { deleteCarListing, getMyCarListings, updateCarListing } from '@/lib/car-rentals-api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { formatCarListingReviewStatus, formatCost } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { CarListingForm } from '@/components/CarListingForm';
import { BrandLoader } from '@/components/BrandLoader';
import { SafeImage } from '@/components/SafeImage';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SuccessBanner } from '@/components/SuccessBanner';
import type { Business, County, CarListing } from '@/lib/types';

const STATUS_BADGE: Record<CarListing['reviewStatus'], string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted_for_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
  suspended: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

const STATUS_MESSAGE: Partial<Record<CarListing['reviewStatus'], string>> = {
  submitted_for_review: "Awaiting admin review — it won't be bookable until approved.",
  rejected: 'This listing was rejected. Editing it below resubmits it for review.',
  suspended: 'This listing has been suspended by an admin and is not publicly visible.',
};

// "My Car Listings" — anyone signed in can list a car here, the same way
// anyone can sign up to drive on Uber or host on Airbnb — no Business or
// Place required (see CarListing's doc comment). `eligibleBusinesses` is
// now purely an optional convenience: a registered rental company that
// already has an approved car_rental Business can link a listing to it,
// but the fleet dashboard itself never gates on having one.
export default function MyCarListingsPage() {
  const { user, token, ready } = useAuth();
  const [eligibleBusinesses, setEligibleBusinesses] = useState<Business[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [listings, setListings] = useState<CarListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<CarListing | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!token) return;
    Promise.all([getMyCarListings(token), getMyBusinesses(token), getCounties()])
      .then(([myListings, myBusinesses, allCounties]) => {
        setListings(myListings);
        setEligibleBusinesses(
          myBusinesses.filter((b) => b.type === 'car_rental' && b.reviewStatus === 'approved'),
        );
        setCounties(allCounties);
      })
      .catch((err) => setLoadError(getFriendlyErrorMessage(err, { context: { action: 'load-my-car-listings' } })))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    reload();
  }, [ready, token, reload]);

  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(id);
  }, [successMessage]);

  async function toggleActive(listing: CarListing) {
    if (!token) return;
    try {
      const updated = await updateCarListing(token, listing.id, { isActive: !listing.isActive });
      setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch (err) {
      setLoadError(getFriendlyErrorMessage(err, { context: { action: 'toggle-car-listing-active', listingId: listing.id } }));
    }
  }

  async function confirmDelete() {
    if (!token || !pendingDelete) return;
    const target = pendingDelete;
    setActionLoading(true);
    setDialogError(null);
    try {
      await deleteCarListing(token, target.id);
      setListings((prev) => prev.filter((l) => l.id !== target.id));
      setPendingDelete(null);
      setSuccessMessage(`"${target.title}" was deleted.`);
    } catch (err) {
      if (isNotFoundError(err)) {
        setListings((prev) => prev.filter((l) => l.id !== target.id));
        setPendingDelete(null);
        setSuccessMessage('This listing was already removed.');
      } else {
        setDialogError(getFriendlyErrorMessage(err, { context: { action: 'delete-car-listing', listingId: target.id } }));
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (!ready || loading) {
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
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Car Listings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to manage your rental fleet.</p>
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
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Car Listings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your fleet — each vehicle is reviewed by our team before it&apos;s bookable.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            + New vehicle
          </button>
        )}
      </div>

      {successMessage && <SuccessBanner>{successMessage}</SuccessBanner>}

      {loadError && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError}
        </p>
      )}

      {!creating && listings.length === 0 && (
        <p className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          <TruckIcon aria-hidden className="h-6 w-6 text-slate-400 dark:text-slate-500" />
          Got a car? List it here — anyone can rent out a vehicle, no rental company required.
        </p>
      )}

      {creating && (
        <CarListingForm
          businesses={eligibleBusinesses}
          counties={counties}
          onSaved={(listing) => {
            setListings((prev) => [listing, ...prev]);
            setCreating(false);
            setSuccessMessage('Your vehicle was submitted for review.');
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      {listings.length > 0 && (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-start gap-3">
                {listing.images[0] && (
                  <SafeImage
                    src={resolveImageUrl(listing.images[0])}
                    alt={listing.title}
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    fallback={<div aria-hidden className="h-16 w-16 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-slate-900 dark:text-slate-50">{listing.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[listing.reviewStatus]}`}>
                      {formatCarListingReviewStatus(listing.reviewStatus)}
                    </span>
                    {!listing.isActive && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {listing.year} {listing.make} {listing.model} · {formatCost(listing.pricePerDay)}/day
                  </p>
                </div>
              </div>

              {STATUS_MESSAGE[listing.reviewStatus] && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{STATUS_MESSAGE[listing.reviewStatus]}</p>
              )}
              {(listing.reviewStatus === 'rejected' || listing.reviewStatus === 'suspended') && listing.rejectionReason && (
                <p className="text-xs text-flag-700 dark:text-flag-300">Reviewer note: {listing.rejectionReason}</p>
              )}

              {editingId === listing.id ? (
                <CarListingForm
                  listing={listing}
                  businesses={eligibleBusinesses}
                  counties={counties}
                  onSaved={(updated) => {
                    setListings((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
                    setEditingId(null);
                    setSuccessMessage('Changes saved.');
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingId(listing.id)}
                    className="self-start text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                  >
                    Edit
                  </button>
                  {listing.reviewStatus === 'approved' && (
                    <button
                      type="button"
                      onClick={() => toggleActive(listing)}
                      className="self-start text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      {listing.isActive ? 'Pause listing' : 'Resume listing'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDelete(listing)}
                    className="self-start text-xs font-medium text-flag-700 dark:text-flag-300 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete != null}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : 'Delete this vehicle?'}
        description="This removes the listing for good, including its review history."
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        isLoading={actionLoading}
        error={dialogError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (actionLoading) return;
          setPendingDelete(null);
          setDialogError(null);
        }}
      />
    </main>
  );
}
