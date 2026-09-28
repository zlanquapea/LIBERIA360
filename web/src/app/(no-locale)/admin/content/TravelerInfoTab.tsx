'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { getTravelerInfo, updateTravelerInfo } from '@/lib/traveler-info-api';
import { HttpError } from '@/lib/http';
import type { TravelerInfoSettings } from '@/lib/types';
import { inputClass } from './content-shared';

// Practical traveler tools — a small singleton form, not a list-and-edit
// pattern like the other tabs, since there's only ever one row (see
// TravelerInfoSettings' own doc comment). Plain admin, not super-admin —
// this is public content, not security config.
export function TravelerInfoTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<TravelerInfoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTravelerInfo()
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">Traveler Info</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Public, practical info shown on <code>/travel-info</code> — a currency rate, visa/entry requirements, and a
        seasonal note. Each block only renders on the public page once you&apos;ve set it here.
      </p>
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : loadError ? (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError}
        </p>
      ) : settings ? (
        <TravelerInfoForm token={token} settings={settings} onSaved={setSettings} />
      ) : null}
    </div>
  );
}

function TravelerInfoForm({
  token,
  settings,
  onSaved,
}: {
  token: string;
  settings: TravelerInfoSettings;
  onSaved: (settings: TravelerInfoSettings) => void;
}) {
  const [usdToLrdRate, setUsdToLrdRate] = useState(settings.usdToLrdRate?.toString() ?? '');
  const [visaInfo, setVisaInfo] = useState(settings.visaInfo ?? '');
  const [entryRequirements, setEntryRequirements] = useState(settings.entryRequirements ?? '');
  const [currentSeasonNote, setCurrentSeasonNote] = useState(settings.currentSeasonNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const rate = usdToLrdRate.trim() ? Number(usdToLrdRate) : undefined;
      const updated = await updateTravelerInfo(token, {
        usdToLrdRate: rate,
        visaInfo: visaInfo.trim() || undefined,
        entryRequirements: entryRequirements.trim() || undefined,
        currentSeasonNote: currentSeasonNote.trim() || undefined,
      });
      setSuccess(true);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        USD → LRD rate
        <input
          type="number"
          min={0}
          max={1000}
          step="0.0001"
          placeholder="e.g. 190"
          value={usdToLrdRate}
          onChange={(e) => setUsdToLrdRate(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Visa info
        <textarea
          rows={3}
          maxLength={4000}
          placeholder="e.g. Visa on arrival for most visitors..."
          value={visaInfo}
          onChange={(e) => setVisaInfo(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Entry requirements
        <textarea
          rows={3}
          maxLength={4000}
          placeholder="e.g. Passport valid 6+ months, yellow fever certificate..."
          value={entryRequirements}
          onChange={(e) => setEntryRequirements(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Current season note
        <textarea
          rows={2}
          maxLength={2000}
          placeholder="e.g. Rainy season, May–Oct: expect afternoon downpours..."
          value={currentSeasonNote}
          onChange={(e) => setCurrentSeasonNote(e.target.value)}
          className={inputClass}
        />
      </label>
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
        {submitting ? 'Saving…' : 'Save traveler info'}
      </button>
    </form>
  );
}
