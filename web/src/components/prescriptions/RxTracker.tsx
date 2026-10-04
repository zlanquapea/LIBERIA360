import { CheckIcon } from '@heroicons/react/24/solid';
import type { EPrescription } from '@/lib/clinic-api';
import { rxSteps } from '@/lib/prescriptions';

/** Where a prescription is on its way to the patient. */
export function RxTracker({ rx }: { rx: EPrescription }) {
  const steps = rxSteps(rx);
  return (
    <ol className="flex flex-col gap-0" aria-label="Prescription progress">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-3 last:pb-0">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={`absolute left-[0.6875rem] top-6 h-[calc(100%-1.25rem)] w-0.5 ${s.state === 'done' ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`}
            />
          )}
          <span
            className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              s.state === 'done'
                ? 'bg-brand-600 text-white'
                : s.state === 'current'
                  ? 'bg-gold-300 text-brand-950 ring-4 ring-gold-300/30'
                  : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {s.state === 'done' ? <CheckIcon aria-hidden className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span
            className={`text-sm ${s.state === 'upcoming' ? 'text-slate-400' : 'font-semibold text-slate-900 dark:text-slate-50'}`}
          >
            {s.label}
            {s.state === 'current' && <span className="sr-only"> (current step)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
