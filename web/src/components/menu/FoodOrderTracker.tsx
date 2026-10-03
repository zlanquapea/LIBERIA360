import { CheckIcon } from '@heroicons/react/20/solid';
import { trackerIndex, trackerSteps } from '@/lib/food-ordering';
import type { FoodOrder } from '@/lib/types';

// Placed → Confirmed → Preparing → On the way / Ready → Delivered / Picked up.
// Declined and cancelled orders leave the happy path and show no tracker.
export function FoodOrderTracker({ order }: { order: Pick<FoodOrder, 'status' | 'fulfillment'> }) {
  const current = trackerIndex(order);
  if (current < 0) return null;
  const steps = trackerSteps(order.fulfillment);
  return (
    <ol aria-label="Order progress" className="flex items-start">
      {steps.map((step, i) => {
        const done = i < current || order.status === 'completed';
        const active = i === current && order.status !== 'completed';
        return (
          <li key={step.status} className="flex flex-1 flex-col items-center gap-1.5 text-center" aria-current={active ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : i <= current ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
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
              <span className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'invisible' : i < current ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
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
