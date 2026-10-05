import { CheckIcon } from '@heroicons/react/20/solid';

export type OrderStep = { key: string; label: string; state: 'done' | 'current' | 'upcoming' };

/**
 * The labelled, left-to-right progress line every order uses (restaurant
 * and pharmacy alike), so an order looks the same whatever it's for.
 */
export function OrderStepper({ steps }: { steps: OrderStep[] }) {
  const current = steps.findIndex((s) => s.state === 'current');
  const reached = current < 0 ? steps.length - 1 : current;
  return (
    <ol aria-label="Order progress" className="flex items-start">
      {steps.map((step, i) => {
        const done = step.state === 'done';
        const active = step.state === 'current';
        return (
          <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" aria-current={active ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : i <= reached ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? 'bg-brand-600 text-white'
                    : active
                      ? 'bg-white text-brand-700 ring-2 ring-brand-600 dark:bg-slate-900 dark:text-brand-300'
                      : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                }`}
              >
                {done ? <CheckIcon aria-hidden className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'invisible' : i < reached ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
            </div>
            <span
              className={`text-[11px] font-semibold leading-tight ${
                active ? 'text-brand-700 dark:text-brand-300' : done ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
