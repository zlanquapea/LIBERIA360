'use client';

import { useTranslations } from 'next-intl';
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import {
  DEFAULT_VISIT_HOURS,
  PACE_HOURS,
  DEFAULT_PACE,
  ROAD_FACTOR,
  analyzeTrip,
  type TripWarning,
} from '@/lib/trip-checks';
import type { ItineraryStopDetail, TransportMode, TripPace } from '@/lib/types';

// Day-by-day time estimates and anything that needs attention before the
// trip. The assumptions behind every number are printed underneath.
export function TripPlanChecks({
  stops,
  durationDays,
  transportMode,
  pace,
  startDate,
  endDate,
}: {
  stops: ItineraryStopDetail[];
  durationDays: number;
  transportMode: TransportMode | null;
  pace: TripPace | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const t = useTranslations('trips');
  if (stops.length === 0) return null;
  const analysis = analyzeTrip(stops, { durationDays, transportMode, pace, startDate, endDate });
  const transportLabel = transportMode ? t(`transport_${transportMode}`) : t('transportUnset');

  function warningText(w: TripWarning): string {
    switch (w.kind) {
      case 'day_too_full':
        return t('warnDayTooFull', { day: w.day, hours: w.hours, limit: w.limit });
      case 'long_leg':
        return t('warnLongLeg', { day: w.day, from: w.from, to: w.to, hours: w.hours });
      case 'empty_day':
        return t('warnEmptyDay', { day: w.day });
      case 'missing_hours':
        return t('warnMissingHours', { title: w.title });
      case 'missing_price':
        return t('warnMissingPrice', { title: w.title });
      case 'event_outside_dates':
        return t('warnEventOutsideDates', { title: w.title });
    }
  }

  const serious = analysis.warnings.filter((w) => ['day_too_full', 'long_leg', 'event_outside_dates'].includes(w.kind));
  const info = analysis.warnings.filter((w) => !serious.includes(w));

  return (
    <section aria-labelledby="plan-checks" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <h2 id="plan-checks" className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
        {t('planChecksTitle')}
      </h2>

      {analysis.days.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {analysis.days.map((d) => {
            const pct = Math.min(100, Math.round((d.totalHours / d.limitHours) * 100));
            return (
              <li key={d.day} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{t('dayChip', { day: d.day })}</span>
                  <span className={d.overLimit ? 'font-semibold text-sunset-700 dark:text-sunset-300' : 'text-slate-600 dark:text-slate-300'}>
                    {t('dayHours', { total: d.totalHours, visit: d.visitHours, travel: d.travelHours })}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={d.limitHours}
                  aria-valuenow={d.totalHours}
                  aria-label={t('dayLoadLabel', { day: d.day })}
                >
                  <div className={`h-full rounded-full ${d.overLimit ? 'bg-sunset-600' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {analysis.warnings.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-brand-800 dark:text-brand-200">
          <CheckCircleIcon aria-hidden className="h-5 w-5" />
          {t('planLooksRealistic')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {serious.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {serious.map((w, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-sunset-50 px-3 py-2 text-sm text-sunset-900 dark:bg-sunset-900/20 dark:text-sunset-100">
                  <ExclamationTriangleIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  {warningText(w)}
                </li>
              ))}
            </ul>
          )}
          {info.length > 0 && (
            <details className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <summary className="cursor-pointer font-semibold">{t('missingInfoSummary', { count: info.length })}</summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 ps-5">
                {info.map((w, i) => (
                  <li key={i}>{warningText(w)}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        <InformationCircleIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        {t('planAssumptions', {
          speed: analysis.speedKmh,
          transport: transportLabel,
          factor: ROAD_FACTOR,
          visit: DEFAULT_VISIT_HOURS,
          limit: PACE_HOURS[pace ?? DEFAULT_PACE],
          pace: t(`pace_${pace ?? DEFAULT_PACE}`),
        })}
      </p>
    </section>
  );
}
