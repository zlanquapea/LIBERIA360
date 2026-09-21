'use client';

import { useTranslations } from 'next-intl';
import { formatCost } from '@/lib/format';
import type { ItineraryStopDetail } from '@/lib/types';

// One line per stop kind, each using the closest thing that entity has to
// "what this costs to add to the trip": a place's entry fee, an event's
// ticket price (falling back to its cheapest ticket type when the bare
// ticketPrice field is unset but ticketTypes carry real prices), and a car
// listing's per-day rate times its own minimum rental — the same number
// its own listing page quotes as the starting price.
function stopCost(stop: ItineraryStopDetail): number {
  if (stop.place) return stop.place.estimatedCostEntry ?? 0;
  if (stop.event) {
    if (stop.event.ticketPrice != null) return Number(stop.event.ticketPrice);
    if (stop.event.ticketTypes.length > 0) {
      return Math.min(...stop.event.ticketTypes.map((tt) => Number(tt.price)));
    }
    return 0;
  }
  if (stop.carListing) return stop.carListing.pricePerDay * stop.carListing.minRentalDays;
  return 0;
}

// A rough trip-level estimate (Sep 2026 UX pass) — every stop kind already
// carries a real price field, this just sums them client-side (no backend
// change: every field it reads is already on the GET /itineraries/:id and
// GET /itineraries/public/:id responses). Deliberately labeled as an
// estimate rather than a firm total — three very different pricing shapes
// (entry fee, ticket price, per-day rental) collapsed into one number is
// useful for a rough sense of scale, not something to book against.
export function TripCostSummary({ stops }: { stops: ItineraryStopDetail[] }) {
  const t = useTranslations('trips');
  if (stops.length === 0) return null;

  const total = stops.reduce((sum, stop) => sum + stopCost(stop), 0);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-sm">
      <p className="font-medium text-slate-900 dark:text-slate-50">
        {t('estimatedCost', { amount: formatCost(total) })}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{t('estimatedCostDisclaimer')}</p>
    </div>
  );
}
