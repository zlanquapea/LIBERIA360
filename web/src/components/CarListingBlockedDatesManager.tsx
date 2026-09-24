'use client';

import { useEffect, useState } from 'react';
import {
  createCarListingBlockedDate,
  deleteCarListingBlockedDate,
  getCarListingBlockedDates,
} from '@/lib/car-rentals-api';
import { HttpError } from '@/lib/http';
import type { CarListingBlockedDate } from '@/lib/types';

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

// Edit-mode-only fleet tool: lets an owner block off dates (maintenance,
// personal use, already rented elsewhere) so the public availability
// endpoint and the booking-overlap check both account for them. Needs a
// saved listing id, so it only ever mounts from CarListingForm's edit path.
export function CarListingBlockedDatesManager({
  token,
  carListingId,
}: {
  token: string;
  carListingId: string;
}) {
  const [blocks, setBlocks] = useState<CarListingBlockedDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCarListingBlockedDates(token, carListingId)
      .then((data) => {
        if (!cancelled) setBlocks(data);
      })
      .catch(() => {
        // Non-fatal — the manager just starts empty; the form itself still works.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, carListingId]);

  async function handleAdd() {
    if (!startDate || !endDate) {
      setError('Choose a start and end date.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createCarListingBlockedDate(token, carListingId, {
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      setBlocks((prev) => [...prev, created]);
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not add this block. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(blockedDateId: string) {
    try {
      await deleteCarListingBlockedDate(token, carListingId, blockedDateId);
      setBlocks((prev) => prev.filter((b) => b.id !== blockedDateId));
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Could not remove this block. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Blocked dates</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Block off dates for maintenance, personal use, or a rental booked elsewhere. Renters won&apos;t be able to
        request the car for these dates.
      </p>

      {!loading && blocks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {blocks.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-sm"
            >
              <span>
                {b.startDate} – {b.endDate}
                {b.reason ? ` · ${b.reason}` : ''}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(b.id)}
                aria-label="Remove blocked date"
                className="text-xs font-medium text-flag-700 hover:underline dark:text-flag-300"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputClass}
          aria-label="Block start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className={inputClass}
          aria-label="Block end date"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          maxLength={500}
          className={inputClass}
        />
      </div>
      <button
        type="button"
        onClick={handleAdd}
        disabled={saving}
        className="inline-flex w-fit items-center gap-1 rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-brand-500 hover:text-brand-700 disabled:opacity-60 dark:hover:text-brand-300"
      >
        {saving ? 'Adding…' : '+ Add blocked date'}
      </button>
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}
