import { useLocale, useTranslations } from 'next-intl';
import type { OpeningPeriod } from '@/lib/types';
import { formatClock, isAlwaysOpen, weekRows } from '@/lib/weekly-hours';
import { weekdayName } from './HoursStatus';

/** The week's opening hours, Monday first, with today picked out. */
export function WeeklyHours({ hours }: { hours: OpeningPeriod[] }) {
  const t = useTranslations('placeKind');
  const locale = useLocale();
  if (isAlwaysOpen(hours)) {
    return <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{t('open24Every')}</p>;
  }
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{t('hoursTitle')}</caption>
      <tbody>
        {weekRows(hours).map((row) => (
          <tr key={row.day} className={row.today ? 'font-bold text-slate-950 dark:text-white' : 'text-slate-600 dark:text-slate-300'}>
            <th scope="row" className="py-1.5 pe-4 text-start font-[inherit]">
              {weekdayName(row.day, locale)}
              {row.today && <span className="ms-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">{t('today')}</span>}
            </th>
            <td className="py-1.5 text-end tabular-nums">
              {row.ranges.length === 0
                ? t('closed')
                : row.ranges.map(([o, c]) => `${formatClock(o, locale)} – ${formatClock(c, locale)}`).join(', ')}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
