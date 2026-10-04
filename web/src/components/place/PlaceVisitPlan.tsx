import { getTranslations } from 'next-intl/server';
import { BanknotesIcon, MapIcon, ShieldCheckIcon, UserGroupIcon, TruckIcon } from '@heroicons/react/24/outline';
import type { Place } from '@/lib/types';
import { estimateTravelTime, formatCost, formatDistance } from '@/lib/format';
import { LrdHint } from '@/components/LrdHint';

/**
 * For sights: what it costs (entry, a guide, getting there — with L$),
 * how to get there, and the county's safety tips and customs, in one
 * place. Each part appears only when there's something real to say.
 */
export async function PlaceVisitPlan({ place }: { place: Place }) {
  const t = await getTranslations('placeKind');
  const costs = [
    { key: 'entry', icon: BanknotesIcon, usd: place.estimatedCostEntry },
    { key: 'guide', icon: UserGroupIcon, usd: place.estimatedCostGuide },
    { key: 'transport', icon: TruckIcon, usd: place.estimatedCostTransport },
  ].filter((c) => c.usd != null);
  const distance = formatDistance(place.distanceFromMonroviaKm);
  const travel = estimateTravelTime(place.distanceFromMonroviaKm);
  const county = place.county;
  const hasSafety = county.safetyTips.length > 0 || Boolean(county.localCustoms);
  if (costs.length === 0 && !place.transportNotes && !distance && !hasSafety) return null;

  return (
    <section aria-labelledby="visit-plan" className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-5 pb-4 pt-5 sm:px-7 dark:border-slate-800">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{t('planEyebrow')}</p>
        <h2 id="visit-plan" className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{t('planTitle')}</h2>
      </div>
      <div className="grid gap-px bg-slate-100 md:grid-cols-2 dark:bg-slate-800">
        {costs.length > 0 && (
          <div className="bg-white p-5 sm:p-7 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{t('costsTitle')}</h3>
            <dl className="mt-3 flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {costs.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <c.icon aria-hidden className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                    {t(`cost_${c.key}`)}
                  </dt>
                  <dd className="text-end">
                    <span className="font-display text-lg font-bold text-slate-950 dark:text-white">{c.usd === 0 ? t('free') : formatCost(c.usd)}</span>
                    <LrdHint usd={c.usd} className="block text-xs" />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('costsNote')}</p>
          </div>
        )}
        {(place.transportNotes || distance) && (
          <div className="bg-white p-5 sm:p-7 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <MapIcon aria-hidden className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              {t('gettingThere')}
            </h3>
            {distance && (
              <p className="mt-3 font-display text-lg font-bold text-slate-950 dark:text-white">
                {distance}
                {travel && <span className="block text-sm font-normal text-slate-500 dark:text-slate-400">{travel}</span>}
              </p>
            )}
            {place.transportNotes && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{place.transportNotes}</p>}
          </div>
        )}
        {hasSafety && (
          <div className="bg-amber-50/60 p-5 sm:p-7 md:col-span-2 dark:bg-amber-950/20">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <ShieldCheckIcon aria-hidden className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              {t('safetyTitle', { county: county.name })}
            </h3>
            {county.safetyTips.length > 0 && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {county.safetyTips.map((tip) => (
                  <li key={tip} className="flex gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            )}
            {county.localCustoms && (
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">
                <span className="font-semibold">{t('customs')} </span>
                {county.localCustoms}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
