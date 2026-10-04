import { useLocale, useTranslations } from 'next-intl';
import type { OpeningPeriod } from '@/lib/types';
import { formatClock, hoursStatus } from '@/lib/weekly-hours';

function weekdayName(day: number, locale: string) {
  // 2026-01-04 was a Sunday (dayOfWeek 0).
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + day)));
}

/** "Open 24 hours", "Open now · closes 6:00 PM", "Closed · opens 8:00 AM
 * tomorrow" — or the place's own hours text when it has no structured
 * hours, or a nudge to call ahead when it has none at all. */
export function HoursStatus({
  hours,
  fallbackText,
  size = 'md',
}: {
  hours: OpeningPeriod[] | null | undefined;
  fallbackText?: string | null;
  size?: 'md' | 'lg';
}) {
  const t = useTranslations('placeKind');
  const locale = useLocale();
  const status = hoursStatus(hours);
  const big = size === 'lg';
  const pill = `inline-flex items-center gap-2 rounded-full font-bold ${big ? 'px-4 py-2 text-base' : 'px-3 py-1 text-sm'}`;
  const dot = (cls: string) => <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${cls}`} />;

  if (!status) {
    return fallbackText ? (
      <span className={`${pill} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>{fallbackText}</span>
    ) : (
      <span className={`${pill} bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200`}>{t('hoursUnknown')}</span>
    );
  }
  if (status.state === 'always') {
    return <span className={`${pill} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`}>{dot('bg-emerald-500')}{t('open24')}</span>;
  }
  if (status.state === 'open') {
    return (
      <span className={`${pill} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`}>
        {dot('bg-emerald-500')}
        {t('openUntil', { time: formatClock(status.closesAt, locale) })}
      </span>
    );
  }
  if (status.state === 'closed') {
    const when =
      status.opensDay === 'today'
        ? t('opensToday', { time: formatClock(status.opensAt, locale) })
        : status.opensDay === 'tomorrow'
          ? t('opensTomorrow', { time: formatClock(status.opensAt, locale) })
          : t('opensOn', { time: formatClock(status.opensAt, locale), day: weekdayName(status.opensDay, locale) });
    return <span className={`${pill} bg-rose-50 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200`}>{dot('bg-rose-500')}{when}</span>;
  }
  return <span className={`${pill} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200`}>{t('closedNow')}</span>;
}

export { weekdayName };
