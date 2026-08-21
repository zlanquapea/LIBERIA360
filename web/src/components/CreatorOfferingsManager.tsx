'use client';

import { useState, type FormEvent } from 'react';
import { addOffering, removeOffering, updateOffering } from '@/lib/creator-api';
import { formatPriceFrom } from '@/lib/format';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { ConfirmDialog } from './ConfirmDialog';
import type { CreatorOffering } from '@/lib/types';

const EMPTY_FORM = { title: '', description: '', priceFrom: '', durationLabel: '', location: '' };

// Services & Experiences manager — same immediate-per-item-mutation shape
// as CreatorPortfolioManager (each offering is its own row on the
// backend), but with a small add-form instead of a file picker since
// there's no upload step, just structured fields.
export function CreatorOfferingsManager({
  token,
  offerings,
  onChange,
}: {
  token: string;
  offerings: CreatorOffering[];
  onChange: (next: CreatorOffering[]) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingRemove, setPendingRemove] = useState<CreatorOffering | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const offering = await addOffering(token, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priceFrom: form.priceFrom ? Number(form.priceFrom) : undefined,
        durationLabel: form.durationLabel.trim() || undefined,
        location: form.location.trim() || undefined,
      });
      onChange([...offerings, offering]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'add-offering' } }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFieldBlur(offering: CreatorOffering, field: 'title' | 'description', value: string) {
    if (value === (offering[field] ?? '')) return;
    try {
      const updated = await updateOffering(token, offering.id, { [field]: value } as Record<string, string>);
      onChange(offerings.map((o) => (o.id === offering.id ? updated : o)));
    } catch {
      // Non-blocking, same reasoning as CreatorPortfolioManager's field blur.
    }
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeOffering(token, pendingRemove.id);
      onChange(offerings.filter((o) => o.id !== pendingRemove.id));
      setPendingRemove(null);
    } catch (err) {
      if (isNotFoundError(err)) {
        onChange(offerings.filter((o) => o.id !== pendingRemove.id));
        setPendingRemove(null);
      } else {
        setRemoveError(
          getFriendlyErrorMessage(err, { context: { action: 'remove-offering', offeringId: pendingRemove.id } }),
        );
      }
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {offerings.length > 0 && (
        <div className="flex flex-col gap-2">
          {offerings.map((offering) => (
            <div key={offering.id} className="flex flex-col gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <input
                  defaultValue={offering.title}
                  onBlur={(e) => handleFieldBlur(offering, 'title', e.target.value)}
                  maxLength={150}
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-slate-900 dark:text-slate-50 outline-none hover:border-slate-300 focus:border-brand-500 dark:hover:border-slate-700"
                />
                <div className="flex items-center gap-2">
                  {offering.priceFrom !== null && <span className="text-xs text-slate-500 dark:text-slate-400">{formatPriceFrom(offering.priceFrom)}</span>}
                  <button
                    type="button"
                    onClick={() => setPendingRemove(offering)}
                    aria-label="Remove offering"
                    className="text-xs text-flag-700 dark:text-flag-300 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <textarea
                defaultValue={offering.description ?? ''}
                onBlur={(e) => handleFieldBlur(offering, 'description', e.target.value)}
                placeholder="Description"
                rows={2}
                maxLength={2000}
                className="rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-600 dark:text-slate-300 outline-none hover:border-slate-300 focus:border-brand-500 dark:hover:border-slate-700"
              />
              <p className="flex flex-wrap gap-x-3 px-1 text-xs text-slate-400 dark:text-slate-400">
                {offering.durationLabel && <span>{offering.durationLabel}</span>}
                {offering.location && <span>{offering.location}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-3">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Add a service or experience</p>
        <input
          placeholder="Title (e.g. Half-day photo shoot)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          maxLength={150}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={2}
          maxLength={2000}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            placeholder="Starting price ($)"
            type="number"
            min={0}
            step="0.01"
            value={form.priceFrom}
            onChange={(e) => setForm({ ...form, priceFrom: e.target.value })}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          />
          <input
            placeholder="Duration (e.g. 4 hours)"
            value={form.durationLabel}
            onChange={(e) => setForm({ ...form, durationLabel: e.target.value })}
            maxLength={100}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          />
          <input
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            maxLength={150}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !form.title.trim()}
          className="self-start rounded-full bg-brand-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : '+ Add'}
        </button>
      </form>

      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}

      <ConfirmDialog
        open={pendingRemove != null}
        title={pendingRemove ? `Remove "${pendingRemove.title}"?` : 'Remove this offering?'}
        description="It will no longer show on your public profile."
        confirmLabel="Remove"
        loadingLabel="Removing…"
        isLoading={removing}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => {
          if (removing) return;
          setPendingRemove(null);
          setRemoveError(null);
        }}
      />
    </div>
  );
}
