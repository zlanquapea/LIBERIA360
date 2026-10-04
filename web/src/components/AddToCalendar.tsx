'use client';

import { useTranslations } from 'next-intl';
import { CalendarDaysIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { googleCalendarUrl, icsContent, type CalendarEvent } from '@/lib/calendar';

/** "Add to Google Calendar" as a link, and a calendar file that Apple
 * Calendar and Outlook open. */
export function AddToCalendar({ event }: { event: CalendarEvent }) {
  const t = useTranslations('eventPage');

  function downloadIcs() {
    const blob = new Blob([icsContent(event)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'event'}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const btn =
    'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30';

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('addToCalendar')}</p>
      <div className="flex gap-2">
        <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={btn}>
          <CalendarDaysIcon aria-hidden className="h-4 w-4 text-brand-600" />
          Google
        </a>
        <button type="button" onClick={downloadIcs} className={btn}>
          <ArrowDownTrayIcon aria-hidden className="h-4 w-4 text-brand-600" />
          {t('appleOutlook')}
        </button>
      </div>
    </div>
  );
}
