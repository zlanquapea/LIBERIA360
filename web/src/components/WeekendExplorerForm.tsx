'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type FormEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { generateWeekend } from '@/lib/itinerary-api';
import { HttpError } from '@/lib/http';
import { formatBudgetBand } from '@/lib/format';
import { CategoryIcon } from '@/lib/icons';
import { requestGeolocation, type Coords } from '@/lib/geolocation';
import { BrandLoader } from './BrandLoader';
import type { BudgetBand, Category } from '@/lib/types';

const BUDGET_BANDS: BudgetBand[] = ['budget', 'moderate', 'premium'];
const TRAVEL_TIME_PRESETS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
] as const;

// Weekend Explorer (Tech Spec §3.2) — same generation engine as Build My
// Liberia Trip, but starts from the user's current location (not
// Monrovia) and filters by travel time instead of a fixed day count.
export function WeekendExplorerForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [maxTravelTimeMinutes, setMaxTravelTimeMinutes] = useState(60);
  const [durationDays, setDurationDays] = useState(1);
  const [budgetBand, setBudgetBand] = useState<BudgetBand>('moderate');
  const [interests, setInterests] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    setLocating(true);
    setLocationError(null);
    requestGeolocation()
      .then((coords) => setCoords(coords))
      .catch((err: Error) => setLocationError(err.message))
      .finally(() => setLocating(false));
  }, []);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !coords) return;
    setSubmitting(true);
    setError(null);
    try {
      const itinerary = await generateWeekend(token, {
        startLat: coords.lat,
        startLng: coords.lng,
        maxTravelTimeMinutes,
        durationDays,
        budgetBand,
        interests,
      });
      router.push(`/trips/${itinerary.id}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-5">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Log in
        </Link>{' '}
        to use Weekend Explorer.
      </p>
    );
  }

  if (!coords) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-10 text-center">
        <PaperAirplaneIcon aria-hidden className="h-10 w-10 -rotate-45 text-brand-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Share your location to find what&apos;s within reach.</p>
        <button
          type="button"
          onClick={requestLocation}
          disabled={locating}
          className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {locating ? 'Finding you…' : 'Use my location'}
        </button>
        {locationError && (
          <p role="alert" className="max-w-sm text-sm text-flag-700 dark:text-flag-300">
            {locationError}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Max travel time</legend>
        <div className="flex flex-wrap gap-2">
          {TRAVEL_TIME_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => setMaxTravelTimeMinutes(preset.minutes)}
              aria-pressed={maxTravelTimeMinutes === preset.minutes}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                maxTravelTimeMinutes === preset.minutes
                  ? 'border-transparent bg-brand-700 text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
              }`}
            >
              {preset.label}
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
          max={3}
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
                <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-4 w-4" />
                {category.name}
              </button>
            );
          })}
        </div>
      </fieldset>

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
        {submitting ? 'Finding your weekend…' : 'Plan my weekend'}
      </button>
    </form>
  );
}
