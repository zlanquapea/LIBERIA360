'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { generateTrip, previewTrip } from '@/lib/itinerary-api';
import { savePendingTripDraft, takePendingTripDraft } from '@/lib/pending-trip-draft';
import { HttpError } from '@/lib/http';
import { formatBudgetBand } from '@/lib/format';
import { CategoryIcon } from '@/lib/icons';
import { requestGeolocation, type Coords } from '@/lib/geolocation';
import { ItineraryStops } from './ItineraryStops';
import type { BudgetBand, Category, TripPreviewResponse } from '@/lib/types';

const BUDGET_BANDS: BudgetBand[] = ['budget', 'moderate', 'premium'];

// "Build My Liberia Trip" (Tech Spec §4.3) — duration + interests + budget
// generates a day-by-day route server-side (nearest-neighbor sequencing
// from Monrovia).
//
// Guest-first (product review readout, Aug 22, 2026): a visitor with no
// account still gets a real generated route from this same form, via the
// unauthenticated /itineraries/preview endpoint — nothing is saved. Only
// "Log in to save this trip" asks for an account, and it hands the exact
// same inputs to the normal save endpoint afterward (see
// pending-trip-draft.ts), so what they see here is what they get.
export function TripPlannerForm({
  categories,
  initialInterests,
}: {
  categories: Category[];
  initialInterests?: string[];
}) {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [durationDays, setDurationDays] = useState(3);
  const [budgetBand, setBudgetBand] = useState<BudgetBand>('moderate');
  const [interests, setInterests] = useState<string[]>(initialInterests ?? []);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TripPreviewResponse | null>(null);
  const [resuming, setResuming] = useState(false);
  const resumedRef = useRef(false);

  // Product review readout (Aug 25, 2026): "Allow users to enter their
  // budget, number of days, interests and starting location." Optional —
  // leaving it unset keeps the previous behavior (routes built outward
  // from Monrovia), so this is purely additive.
  const [startCoords, setStartCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const useMyLocation = useCallback(() => {
    setLocating(true);
    setLocationError(null);
    requestGeolocation()
      .then((coords) => setStartCoords(coords))
      .catch((err: Error) => setLocationError(err.message))
      .finally(() => setLocating(false));
  }, []);

  // Picks back up a guest-built trip the moment login finishes: if this
  // visitor clicked "Log in to save" a minute ago, the draft they were
  // looking at is sitting in sessionStorage, waiting to be handed to the
  // real save endpoint now that there's a token to save it under.
  useEffect(() => {
    if (!ready || !user || !token || resumedRef.current) return;
    const draft = takePendingTripDraft();
    if (!draft) return;
    resumedRef.current = true;
    setDurationDays(draft.durationDays);
    setBudgetBand(draft.budgetBand);
    setInterests(draft.interests);
    setTitle(draft.title ?? '');
    if (draft.startLat !== undefined && draft.startLng !== undefined) {
      setStartCoords({ lat: draft.startLat, lng: draft.startLng });
    }
    setPreview(null);
    setResuming(true);
    generateTrip(token, draft)
      .then((itinerary) => router.push(`/trips/${itinerary.id}`))
      .catch((err) => {
        setResuming(false);
        setError(err instanceof HttpError ? err.message : 'Something went wrong saving your trip. Please try again.');
      });
  }, [ready, user, token, router]);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const input = {
      durationDays,
      budgetBand,
      interests,
      startLat: startCoords?.lat,
      startLng: startCoords?.lng,
      title: title.trim() || undefined,
    };
    try {
      if (user && token) {
        const itinerary = await generateTrip(token, input);
        router.push(`/trips/${itinerary.id}`);
        return;
      }
      const result = await previewTrip(input);
      setPreview(result);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleLoginToSave() {
    savePendingTripDraft({
      durationDays,
      budgetBand,
      interests,
      startLat: startCoords?.lat,
      startLng: startCoords?.lng,
      title: title.trim() || undefined,
    });
    router.push('/login?next=/trips/new');
  }

  if (!ready || resuming) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{resuming ? 'Saving your trip…' : 'Loading…'}</p>;
  }

  if (preview) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{preview.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {preview.durationDays} day{preview.durationDays === 1 ? '' : 's'} · {formatBudgetBand(preview.budgetBand)}
            {preview.interests.length > 0 && ` · ${preview.interests.join(', ')}`}
          </p>
        </div>

        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          This is a preview — nothing&apos;s saved yet.
        </p>

        <ItineraryStops stops={preview.stops} />

        {error && (
          <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleLoginToSave}
            className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            Log in to save this trip
          </button>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
          >
            Build a different trip
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Trip name (optional)
        <input
          type="text"
          maxLength={200}
          placeholder={`${durationDays}-Day Liberia Trip`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        How many days?
        <input
          type="number"
          required
          min={1}
          max={14}
          value={durationDays}
          onChange={(e) => setDurationDays(Number(e.target.value))}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Budget
        <select
          value={budgetBand}
          onChange={(e) => setBudgetBand(e.target.value as BudgetBand)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        >
          {BUDGET_BANDS.map((b) => (
            <option key={b} value={b}>
              {formatBudgetBand(b)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Starting location (optional)</span>
        {startCoords ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <MapPinIcon aria-hidden className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              Using your current location
            </span>
            <button
              type="button"
              onClick={() => setStartCoords(null)}
              className="text-xs font-medium text-slate-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300"
            >
              Clear
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="flex w-fit items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 disabled:opacity-60"
          >
            <MapPinIcon aria-hidden className="h-4 w-4" />
            {locating ? 'Finding you…' : 'Use my current location'}
          </button>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {startCoords
            ? 'Stops are sequenced starting from here instead of Monrovia.'
            : "Leave this blank to plan a route starting from Monrovia — this only changes the order stops are visited in."}
        </p>
        {locationError && (
          <p role="alert" className="text-xs text-flag-700 dark:text-flag-300">
            {locationError}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Interests (optional — leave blank for all)</legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const selected = interests.includes(category.slug);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleInterest(category.slug)}
                aria-pressed={selected}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  selected
                    ? 'border-transparent bg-brand-700 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
                }`}
              >
                <CategoryIcon iconKey={category.icon} className="h-4 w-4" />
                {category.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      {!user && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          No account needed to see your route — you&apos;ll only be asked to log in if you want to save it.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Building your trip…' : user ? 'Build my trip' : 'Preview my trip'}
      </button>
    </form>
  );
}
