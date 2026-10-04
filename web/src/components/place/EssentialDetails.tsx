import { getTranslations } from 'next-intl/server';
import { BoltIcon, CheckCircleIcon, ClockIcon, CreditCardIcon, DevicePhoneMobileIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import type { Business, Place } from '@/lib/types';
import { WeeklyHours } from './WeeklyHours';

const PAYMENT_AMENITIES = ['mobile_money', 'card_payments'] as const;

/**
 * For health and service places: the week's hours, what they offer, and
 * the practical things people ask before going — whether they take
 * mobile money or cards, and whether there's backup power.
 */
export async function EssentialDetails({ place, business }: { place: Place; business: Business | null }) {
  const t = await getTranslations('placeKind');
  const td = await getTranslations('placeDetail');
  const services = business?.servicesOffered ?? [];
  const amenities = place.amenities ?? [];
  const payments = PAYMENT_AMENITIES.filter((a) => amenities.includes(a));
  const power = amenities.includes('power_backup');
  const otherAmenities = amenities.filter((a) => !PAYMENT_AMENITIES.includes(a as (typeof PAYMENT_AMENITIES)[number]) && a !== 'power_backup');
  const hoursText = business?.openingHours ?? place.openingHours;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-7 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-slate-950 dark:text-slate-50">
          <ClockIcon aria-hidden className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          {t('hoursTitle')}
        </h2>
        <div className="mt-4">
          {place.structuredHours?.length ? (
            <WeeklyHours hours={place.structuredHours} />
          ) : hoursText ? (
            <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{hoursText}</p>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('hoursUnknown')}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-7 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-slate-950 dark:text-slate-50">
          <WrenchScrewdriverIcon aria-hidden className="h-6 w-6 text-brand-600 dark:text-brand-400" />
          {t('servicesTitle')}
        </h2>
        {services.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <CheckCircleIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('servicesUnknown')}</p>
        )}
        {(payments.length > 0 || power) && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {payments.map((p) => (
              <span key={p} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                {p === 'mobile_money' ? <DevicePhoneMobileIcon aria-hidden className="h-4 w-4" /> : <CreditCardIcon aria-hidden className="h-4 w-4" />}
                {t(`pay_${p}`)}
              </span>
            ))}
            {power && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <BoltIcon aria-hidden className="h-4 w-4" />
                {t('powerBackup')}
              </span>
            )}
          </div>
        )}
        {otherAmenities.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {otherAmenities.map((a) => (
              <li key={a} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {td(`amenity_${a}`)}
              </li>
            ))}
          </ul>
        )}
        {place.accessibilityNotes && (
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
            <span className="font-semibold">{td('accessibility')}: </span>
            {place.accessibilityNotes}
          </p>
        )}
      </div>
    </section>
  );
}
