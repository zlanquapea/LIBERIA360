'use client';

import { useTranslations } from 'next-intl';
import { formatCost } from '@/lib/format';
import { costBreakdown } from '@/lib/trip-checks';
import type { ItineraryStopDetail } from '@/lib/types';

// A rough trip-level estimate from the prices listed on each stop: a
// place's entry fee, an event's ticket price (or cheapest ticket type), and
// a car's day rate times its minimum rental. Stops with no price on file
// are named and left out rather than counted as free.
export function TripCostSummary({ stops }: { stops: ItineraryStopDetail[] }) {
  const t = useTranslations('trips');
  if (stops.length === 0) return null;

  const { known, unpriced } = costBreakdown(stops);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
      <p className="font-medium text-slate-900 dark:text-slate-50">
        {t('estimatedCost', { amount: formatCost(known) })}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('estimatedCostDisclaimer')}</p>
      {unpriced.length > 0 && (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {t('estimatedCostUnpriced', { count: unpriced.length, names: unpriced.slice(0, 3).join(', ') })}
        </p>
      )}
    </div>
  );
}
