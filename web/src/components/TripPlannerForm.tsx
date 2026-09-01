'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { generateTrip, previewTrip, type CreateTripInput } from '@/lib/itinerary-api';
import { savePendingTripDraft, takePendingTripDraft } from '@/lib/pending-trip-draft';
import { HttpError } from '@/lib/http';
import { formatBudgetBand } from '@/lib/format';
import { requestGeolocation, type Coords } from '@/lib/geolocation';
import { ItineraryStops } from './ItineraryStops';
import { DestinationAutocomplete } from './DestinationAutocomplete';
import type { BudgetBand, Place, TripPreviewResponse, TripVisibility } from '@/lib/types';

const BUDGET_BANDS: BudgetBand[] = ['budget', 'moderate', 'premium'];

// "Build My Liberia Trip" (Tech Spec §4.3) — duration + budget generates a
// day-by-day route server-side (nearest-neighbor sequencing from Monrovia).
// The route used to also take an "interests" category filter here, but a
// wall of category chips added friction without adding much: searching for
// and picking the actual destination (below) already does the targeting a
// traveler needs, so this form no longer asks for interests at all — it's
// still sent to the API as an empty array, which the backend already
// treats as "match everything."
//
// Guest-first (product review readout, Aug 22, 2026): a visitor with no
// account still gets a real generated route from this same form, via the
// unauthenticated /itineraries/preview endpoint — nothing is saved. Only
// "Log in to save this trip" asks for an account, and it hands the exact
// same inputs to the normal save endpoint afterward (see
// pending-trip-draft.ts), so what they see here is what they get.
export function TripPlannerForm() {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [durationDays, setDurationDays] = useState(3);
  const [budgetBand, setBudgetBand] = useState<BudgetBand>('moderate');
  const [title, setTitle] = useState('');
  // Trip identity + visibility (Aug 2026 social-trip spec, Sections 1-3):
  // a name, a real catalog destination, and a deliberate public/private
  // choice are all required before a trip can be built or even previewed.
  const [destination, setDestination] = useState<Place | null>(null);
  const [visibility, setVisibility] = useState<TripVisibility>('private');
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
    setTitle(draft.title);
    setDestination(draft.destination);
    setVisibility(draft.visibility);
    if (draft.startLat !== undefined && draft.startLng !== undefined) {
      setStartCoords({ lat: draft.startLat, lng: draft.startLng });
    }
    setPreview(null);
    setResuming(true);
    const { destination: _draftDestination, ...input } = draft;
    generateTrip(token, input)
      .then((itinerary) => router.push(`/trips/${itinerary.id}`))
      .catch((err) => {
        setResuming(false);
        setError(err instanceof HttpError ? err.message : 'Something went wrong saving your trip. Please try again.');
      });
  }, [ready, user, token, router]);

  // Shared by both the submit and "log in to save" paths — a trip isn't
  // buildable at all without a name and a real catalog destination
  // (Sections 1-2 of the Aug 2026 spec).
  function buildInput(): CreateTripInput | null {
    if (!title.trim() || !destination) return null;
    return {
      durationDays,
      budgetBand,
      interests: [],
      startLat: startCoords?.lat,
      startLng: startCoords?.lng,
      title: title.trim(),
      destinationPlaceId: destination.id,
      visibility,
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError('Give your trip a name.');
      return;
    }
    if (!destination) {
      setError('Choose a destination.');
      return;
    }
    const input = buildInput();
    if (!input) return;
    setSubmitting(true);
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
    const input = buildInput();
    if (!input || !destination) return;
    savePendingTripDraft({ ...input, destination });
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Trip name
        <input
          type="text"
          required
          maxLength={200}
          placeholder={`${durationDays}-Day Liberia Trip`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <DestinationAutocomplete value={destination} onChange={setDestination} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Who can see this trip?</legend>
        <div className="flex gap-2">
          {(
            [
              { value: 'private' as TripVisibility, label: 'Private', hint: 'Only people you invite' },
              { value: 'public' as TripVisibility, label: 'Public', hint: 'Anyone can find & request to join' },
            ]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setVisibility(option.value)}
              aria-pressed={visibility === option.value}
              className={`flex-1 rounded-lg border px-3 py-2 text-left text-sm ${
                visibility === option.value
                  ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-brand-500'
              }`}
            >
              <span className="block font-medium text-slate-900 dark:text-slate-50">{option.label}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{option.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

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
