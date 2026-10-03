import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarDaysIcon, PlusIcon } from '@heroicons/react/24/outline';
import { EventCard } from '@/components/EventCard';
import type { Event } from '@/lib/types';
import { SectionHeading } from './SectionHeading';

// What's on from Friday to Sunday (or from now, once the weekend has
// started). With nothing listed it says so plainly, offers to list an
// event, and falls back to the next few upcoming events.
export async function WeekendSection({
  events,
  upcoming,
  from,
  to,
  isNow,
}: {
  events: Event[];
  upcoming: Event[];
  from: Date;
  to: Date;
  isNow: boolean;
}) {
  const t = await getTranslations('discover');
  const locale = await getLocale();
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const range = `${fmt.format(from)} – ${fmt.format(to)}`;

  return (
    <section id="this-weekend" aria-labelledby="weekend-heading" className="flex scroll-mt-24 flex-col gap-5">
      <SectionHeading
        id="weekend-heading"
        eyebrow={isNow ? t('weekendNowEyebrow') : t('weekendEyebrow', { range })}
        title={t('weekendTitle')}
        href="/weekend"
        linkLabel={t('weekendSeeAll')}
      />
      {events.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {events.map((event) => (
            <div key={event.id} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-80">
              <EventCard event={event} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5 rounded-[1.75rem] border border-dashed border-slate-300 bg-white/60 p-5 dark:border-slate-700 dark:bg-slate-900/60 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sunset-100 text-sunset-700 dark:bg-sunset-900/40 dark:text-sunset-200">
                <CalendarDaysIcon aria-hidden className="h-6 w-6" />
              </span>
              <div>
                <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">{t('weekendEmptyTitle')}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{t('weekendEmptyBody')}</p>
              </div>
            </div>
            <Link
              href="/events/new"
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:self-auto"
            >
              <PlusIcon aria-hidden className="h-4 w-4" />
              {t('listEvent')}
            </Link>
          </div>
          {upcoming.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('weekendUpcoming')}</p>
              <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {upcoming.map((event) => (
                  <div key={event.id} className="w-[78vw] max-w-sm shrink-0 snap-start sm:w-80">
                    <EventCard event={event} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
