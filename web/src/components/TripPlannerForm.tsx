'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { generateTrip } from '@/lib/itinerary-api';
import { HttpError } from '@/lib/http';
import { formatBudgetBand } from '@/lib/format';
import type { BudgetBand, Category } from '@/lib/types';

const BUDGET_BANDS: BudgetBand[] = ['budget', 'moderate', 'premium'];

// "Build My Liberia Trip" (Tech Spec §4.3) — duration + interests + budget
// generates a day-by-day route server-side (nearest-neighbor sequencing
// from Monrovia); this form just collects the intake.
export function TripPlannerForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const { user, token, ready } = useAuth();

  const [durationDays, setDurationDays] = useState(3);
  const [budgetBand, setBudgetBand] = useState<BudgetBand>('moderate');
  const [interests, setInterests] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInterest(slug: string) {
    setInterests((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const itinerary = await generateTrip(token, {
        durationDays,
        budgetBand,
        interests,
        title: title.trim() || undefined,
      });
      router.push(`/trips/${itinerary.id}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Log in
        </Link>{' '}
        to build a trip.
      </p>
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
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  selected
                    ? 'border-transparent bg-brand-700 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
                }`}
              >
                {category.icon} {category.name}
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
        {submitting ? 'Building your trip…' : 'Build my trip'}
      </button>
    </form>
  );
}
