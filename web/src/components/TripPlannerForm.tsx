'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { generateTrip, previewTrip, type CreateTripInput } from '@/lib/itinerary-api';
import { savePendingTripDraft, takePendingTripDraft } from '@/lib/pending-trip-draft';
import { HttpError } from '@/lib/http';
import { formatBudgetBand, formatTripDateRange } from '@/lib/format';
import { DestinationAutocomplete } from './DestinationAutocomplete';
import { BrandLoader } from './BrandLoader';
import type { BudgetBand, Place, TripPreviewResponse, TripVisibility } from '@/lib/types';

const BUDGET_BANDS: BudgetBand[] = ['budget', 'moderate', 'premium'];
const MAX_TRIP_DURATION_DAYS = 14;

// Turns a start/end date pair into an inclusive day count (matches the
// API's own resolveDurationDays) — used only for the instant "X days" hint
// and client-side range check below; the API derives its own authoritative
// durationDays from the same two dates rather than trusting this value.
function durationDaysFromRange(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

// "Plan a Trip" (Tech Spec §4.3, redesigned per a Sept 2026 product note:
// "do not automatically populate the days with random destinations — a
// person can plan a 3-day trip at a single location," "the user should
// have control"). Earlier versions of this form generated a full day-by-day
// route the moment it was submitted, scattering catalog places across the
// whole country by interest/budget/proximity alone, with no regard for
// whether the traveler wanted one stop or ten. This version creates just
// the trip's shell — its name, dates, destination, and visibility — and
// hands the traveler straight to the trip page, where they add their own
// stops one at a time (AddTripStop), to whichever day(s) they actually
// need. A single search-and-select destination is still required (so the
// trip has somewhere to point to for discovery/join features), but nothing
// about its route is assumed from it.
//
// Guest-first (product review readout, Aug 22, 2026): a visitor with no
// account can still fill this whole form and see exactly what they're
// about to create, via the unauthenticated /itineraries/preview endpoint —
// nothing is saved. Only "Log in to save this trip" asks for an account,
// and it hands the exact same inputs to the normal create endpoint
// afterward (see pending-trip-draft.ts), so what they see here is what
// they get.
export function TripPlannerForm() {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [budgetBand, setBudgetBand] = useState<BudgetBand>('moderate');
  const [title, setTitle] = useState('');
  // Trip identity + visibility (Aug 2026 social-trip spec, Sections 1-3):
  // a name, a real catalog destination, and a deliberate public/private
  // choice are all required before a trip can be created or even previewed.
  const [destination, setDestination] = useState<Place | null>(null);
  const [visibility, setVisibility] = useState<TripVisibility>('private');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TripPreviewResponse | null>(null);
  const [resuming, setResuming] = useState(false);
  const resumedRef = useRef(false);

  const durationDays = startDate && endDate ? durationDaysFromRange(startDate, endDate) : null;

  // Picks back up a guest-built trip the moment login finishes: if this
  // visitor clicked "Log in to save" a minute ago, the draft they were
  // looking at is sitting in sessionStorage, waiting to be handed to the
  // real create endpoint now that there's a token to save it under.
  useEffect(() => {
    if (!ready || !user || !token || resumedRef.current) return;
    const draft = takePendingTripDraft();
    if (!draft) return;
    resumedRef.current = true;
    setStartDate(draft.startDate);
    setEndDate(draft.endDate);
    setBudgetBand(draft.budgetBand);
    setTitle(draft.title);
    setDestination(draft.destination);
    setVisibility(draft.visibility);
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
  // buildable at all without a name, a real catalog destination, and a
  // valid date range (Sections 1-2 of the Aug 2026 spec, plus the Sept
  // 2026 date-range redesign).
  function buildInput(): CreateTripInput | null {
    if (!title.trim() || !destination || !startDate || !endDate) return null;
    return {
      startDate,
      endDate,
      budgetBand,
      interests: [],
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
    if (!startDate || !endDate) {
      setError('Choose a start and end date.');
      return;
    }
    if (endDate < startDate) {
      setError("The end date can't be before the start date.");
      return;
    }
    if ((durationDays ?? 0) > MAX_TRIP_DURATION_DAYS) {
      setError(`Trips can be at most ${MAX_TRIP_DURATION_DAYS} days — pick a shorter date range.`);
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
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-5">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">
          {resuming ? 'Saving your trip…' : 'Loading…'}
        </p>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{preview.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {destination?.name} · {formatTripDateRange(preview.startDate, preview.endDate)} · {preview.durationDays} day
            {preview.durationDays === 1 ? '' : 's'} · {formatBudgetBand(preview.budgetBand)}
          </p>
        </div>

        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
          This is a preview — nothing&apos;s saved yet. Log in to save it, then add your own places for each day.
        </p>

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
            Plan a different trip
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
          placeholder="My Liberia Trip"
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

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">When are you going?</legend>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            Start date
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:text-slate-50"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
            End date
            <input
              type="date"
              required
              min={startDate || undefined}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:text-slate-50"
            />
          </label>
        </div>
        {durationDays !== null && (
          <p
            className={`text-xs ${
              durationDays < 1 || durationDays > MAX_TRIP_DURATION_DAYS
                ? 'text-flag-700 dark:text-flag-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {durationDays < 1
              ? "The end date can't be before the start date."
              : durationDays > MAX_TRIP_DURATION_DAYS
                ? `That's ${durationDays} days — trips can be at most ${MAX_TRIP_DURATION_DAYS}.`
                : `${durationDays} day${durationDays === 1 ? '' : 's'}`}
          </p>
        )}
      </fieldset>

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

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {user
          ? "You'll add your own places next — as few or as many as this trip actually needs, on whichever day(s) you choose."
          : "No account needed to plan — you'll only be asked to log in when you're ready to save this trip."}
      </p>

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
        {submitting ? 'One moment…' : user ? 'Start planning' : 'Continue'}
      </button>
    </form>
  );
}
