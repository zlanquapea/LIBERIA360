'use client';

import { ClockIcon } from '@heroicons/react/24/outline';

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

// Shared Opens/Closes time picker — replaces a free-text "opening hours"
// input across the place-submission form and the business claim/edit forms
// (product feedback, Aug 2026: "they should be able to add the opening and
// closing time, set default starting 7AM and close 9pm"). Structured
// open/close values are formatted into free text via formatDailyHours
// (web/src/lib/opening-hours.ts) at submit time, in a shape the API's
// parseOpeningHoursText can still turn into an "open now" badge — the
// caller owns that formatting, this component only owns the two
// <input type="time"> controls.
export function DailyHoursPicker({
  open,
  close,
  onChange,
}: {
  open: string;
  close: string;
  onChange: (open: string, close: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
      <span className="flex items-center gap-1.5">
        <ClockIcon aria-hidden className="h-4 w-4 text-slate-400" />
        Opening hours
      </span>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-normal text-slate-500 dark:text-slate-400">
          Opens
          <input
            type="time"
            value={open}
            onChange={(e) => onChange(e.target.value, close)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-normal text-slate-500 dark:text-slate-400">
          Closes
          <input
            type="time"
            value={close}
            onChange={(e) => onChange(open, e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <p className="text-xs font-normal text-slate-500 dark:text-slate-400">Applies daily. Defaults to 7:00 AM – 9:00 PM.</p>
    </div>
  );
}
