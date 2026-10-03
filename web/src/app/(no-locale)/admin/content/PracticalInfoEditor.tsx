'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { updatePlace } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
import { AMENITY_LABELS, PRACTICAL_SOURCE_LABELS } from '@/lib/practical-info';
import { PLACE_AMENITIES, type Place, type PlaceAmenity, type PracticalInfoSource } from '@/lib/types';
import { inputClass } from './content-shared';

const SOURCES = Object.keys(PRACTICAL_SOURCE_LABELS) as PracticalInfoSource[];

function money(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// The practical details a visitor relies on (hours, prices, website,
// amenities, access, transport), plus where they came from and when they
// were last confirmed. Everything renders on the public page only when
// set, so leaving a field empty is always the honest choice over guessing.
export function PracticalInfoEditor({
  token,
  place,
  onSaved,
}: {
  token: string;
  place: Place;
  onSaved: (place: Place) => void;
}) {
  const [openingHours, setOpeningHours] = useState(place.openingHours ?? '');
  const [website, setWebsite] = useState(place.website ?? '');
  const [costEntry, setCostEntry] = useState(place.estimatedCostEntry?.toString() ?? '');
  const [costGuide, setCostGuide] = useState(place.estimatedCostGuide?.toString() ?? '');
  const [costTransport, setCostTransport] = useState(place.estimatedCostTransport?.toString() ?? '');
  const [amenities, setAmenities] = useState<PlaceAmenity[]>(place.amenities ?? []);
  const [accessibilityNotes, setAccessibilityNotes] = useState(place.accessibilityNotes ?? '');
  const [transportNotes, setTransportNotes] = useState(place.transportNotes ?? '');
  const [source, setSource] = useState<PracticalInfoSource | ''>(place.practicalInfoSource ?? '');
  const [checkedToday, setCheckedToday] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setOpeningHours(place.openingHours ?? '');
    setWebsite(place.website ?? '');
    setCostEntry(place.estimatedCostEntry?.toString() ?? '');
    setCostGuide(place.estimatedCostGuide?.toString() ?? '');
    setCostTransport(place.estimatedCostTransport?.toString() ?? '');
    setAmenities(place.amenities ?? []);
    setAccessibilityNotes(place.accessibilityNotes ?? '');
    setTransportNotes(place.transportNotes ?? '');
    setSource(place.practicalInfoSource ?? '');
    setCheckedToday(false);
    setSuccess(false);
    // Same reasoning as PlaceEditForm: only a different place resets this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place.id]);

  function toggleAmenity(amenity: PlaceAmenity) {
    setAmenities((prev) => (prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (checkedToday && !source) {
      setError('Choose who supplied these details before marking them checked.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updatePlace(token, place.id, {
        openingHours: openingHours.trim() || undefined,
        website: website.trim() || undefined,
        estimatedCostEntry: money(costEntry),
        estimatedCostGuide: money(costGuide),
        estimatedCostTransport: money(costTransport),
        amenities,
        accessibilityNotes,
        transportNotes,
        practicalInfoSource: source || undefined,
        practicalInfoCheckedAt: checkedToday ? new Date().toISOString() : undefined,
      });
      setSuccess(true);
      setCheckedToday(false);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const lastChecked = place.practicalInfoCheckedAt
    ? new Date(place.practicalInfoCheckedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Practical information</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Shown on the place page only when filled in. Leave anything you haven&apos;t confirmed empty.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Opening hours
        <input
          value={openingHours}
          onChange={(e) => setOpeningHours(e.target.value)}
          placeholder="e.g. Mon-Sat 9:00-18:00"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Website
        <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ['Entry (US$)', costEntry, setCostEntry],
            ['Guide (US$)', costGuide, setCostGuide],
            ['Transport (US$)', costTransport, setCostTransport],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {label}
            <input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => set(e.target.value)}
              className={inputClass}
            />
          </label>
        ))}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">Amenities</legend>
        <div className="flex flex-wrap gap-2">
          {PLACE_AMENITIES.map((amenity) => {
            const on = amenities.includes(amenity);
            return (
              <button
                key={amenity}
                type="button"
                aria-pressed={on}
                onClick={() => toggleAmenity(amenity)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  on
                    ? 'border-brand-600 bg-brand-700 text-white'
                    : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {AMENITY_LABELS[amenity]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Accessibility notes
        <textarea
          rows={2}
          maxLength={1000}
          value={accessibilityNotes}
          onChange={(e) => setAccessibilityNotes(e.target.value)}
          placeholder="e.g. Step-free entrance; the viewpoint is up a steep unpaved path"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Getting there
        <textarea
          rows={2}
          maxLength={1000}
          value={transportNotes}
          onChange={(e) => setTransportNotes(e.target.value)}
          placeholder="e.g. Keke from Red Light to the junction, then a 10-minute walk"
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Source of these details
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as PracticalInfoSource | '')}
            className={inputClass}
          >
            <option value="">Not recorded</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {PRACTICAL_SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={checkedToday}
            onChange={(e) => setCheckedToday(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-brand-700"
          />
          I confirmed these details today
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last checked: {lastChecked ?? 'never recorded'}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save practical information'}
      </button>
    </form>
  );
}
