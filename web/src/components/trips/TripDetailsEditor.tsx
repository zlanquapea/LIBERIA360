'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { formatBudgetBand } from '@/lib/format';
import { HttpError } from '@/lib/http';
import type { BudgetBand, TransportMode, TripPace } from '@/lib/types';
import type { UpdateTripDetailsInput } from '@/lib/itinerary-api';

const TRANSPORT: TransportMode[] = ['own_car', 'taxi', 'public_transport', 'tour_operator', 'mixed'];
const PACES: TripPace[] = ['relaxed', 'balanced', 'packed'];
const BUDGETS: BudgetBand[] = ['budget', 'moderate', 'premium'];

export interface TripDetailsValue {
  startingLocation: string | null;
  transportMode: TransportMode | null;
  pace: TripPace | null;
  budgetBand: BudgetBand;
}

// The practical inputs the plan checks use. Read-only for anyone who
// can't edit; one small form for owners and collaborators.
export function TripDetailsEditor({
  value,
  editable,
  onSave,
}: {
  value: TripDetailsValue;
  editable: boolean;
  onSave?: (input: UpdateTripDetailsInput) => Promise<void>;
}) {
  const t = useTranslations('trips');
  const [editing, setEditing] = useState(false);
  const [startingLocation, setStartingLocation] = useState(value.startingLocation ?? '');
  const [transportMode, setTransportMode] = useState<TransportMode | ''>(value.transportMode ?? '');
  const [pace, setPace] = useState<TripPace | ''>(value.pace ?? '');
  const [budgetBand, setBudgetBand] = useState<BudgetBand>(value.budgetBand);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setStartingLocation(value.startingLocation ?? '');
    setTransportMode(value.transportMode ?? '');
    setPace(value.pace ?? '');
    setBudgetBand(value.budgetBand);
    setError(null);
    setEditing(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        startingLocation: startingLocation.trim() || null,
        transportMode: transportMode || null,
        pace: pace || null,
        budgetBand,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('detailsSaveError'));
    } finally {
      setSaving(false);
    }
  }

  const rows: [string, string | null][] = [
    [t('startingFrom'), value.startingLocation],
    [t('gettingAround'), value.transportMode ? t(`transport_${value.transportMode}`) : null],
    [t('paceLabel'), value.pace ? t(`pace_${value.pace}`) : null],
    [t('budgetLabel'), formatBudgetBand(value.budgetBand)],
  ];

  if (editing) {
    const field = 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50';
    return (
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          {t('startingFrom')}
          <input
            value={startingLocation}
            onChange={(e) => setStartingLocation(e.target.value)}
            maxLength={120}
            placeholder={t('startingFromPlaceholder')}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('gettingAround')}
          <select value={transportMode} onChange={(e) => setTransportMode(e.target.value as TransportMode | '')} className={field}>
            <option value="">{t('notDecided')}</option>
            {TRANSPORT.map((m) => (
              <option key={m} value={m}>
                {t(`transport_${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('paceLabel')}
          <select value={pace} onChange={(e) => setPace(e.target.value as TripPace | '')} className={field}>
            <option value="">{t('notDecided')}</option>
            {PACES.map((p) => (
              <option key={p} value={p}>
                {t(`pace_${p}`)} · {t(`paceHint_${p}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('budgetLabel')}
          <select value={budgetBand} onChange={(e) => setBudgetBand(e.target.value as BudgetBand)} className={field}>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {formatBudgetBand(b)}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-sm text-flag-700 dark:text-flag-300 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={saving} className="min-h-11 rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60">
            {saving ? t('saving') : t('saveDetails')}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300">
            {t('cancelEdit')}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {rows.map(([label, v]) => (
          <div key={label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className={v ? 'text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'}>{v ?? t('notSet')}</dd>
          </div>
        ))}
      </dl>
      {editable && (
        <button
          type="button"
          onClick={startEditing}
          className="inline-flex min-h-10 items-center gap-1.5 self-start rounded-full border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200"
        >
          <PencilSquareIcon aria-hidden className="h-4 w-4" />
          {t('editDetails')}
        </button>
      )}
    </div>
  );
}
