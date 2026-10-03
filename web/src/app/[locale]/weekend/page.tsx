import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CalendarDaysIcon, ClockIcon, PlusIcon } from '@heroicons/react/24/outline';
import { getCounties, getCreatorGuides, getPlaces, getUpcomingEvents } from '@/lib/api';
import { openOnDays, weekendDays, weekendTripDates, weekendWindow } from '@/lib/home-discovery';
import { EventCard } from '@/components/EventCard';
import { PlaceCardCompact } from '@/components/PlaceCardCompact';
import { GuideCard } from '@/components/creator-guides/GuideCard';
import { SectionHeading } from '@/components/home/SectionHeading';

export const metadata = {
  title: 'This weekend in Liberia — LIBERIA360',
  description: "Events, places with weekend opening hours, and local guides for this weekend.",
};

const PLACES_LIMIT = 8;

// This weekend, in one place: what's on, which places list weekend hours,
// and local guides to build a plan from. Filterable by county; every item
// comes from live listings, and an empty section says so.
export default async function WeekendPage({ searchParams }: { searchParams: Promise<{ county?: string }> }) {
  const { county: countyParam } = await searchParams;
  const t = await getTranslations('weekend');
  const locale = await getLocale();
  const window = weekendWindow();
  const counties = await getCounties();
  const county = counties.find((c) => c.slug === countyParam) ?? null;

  const [events, places, guides] = await Promise.all([
    getUpcomingEvents({
      dateFrom: window.from.toISOString(),
      dateTo: window.to.toISOString(),
      county: county?.slug,
      limit: 24,
    }),
    getPlaces({ county: county?.slug, sort: 'featured', limit: 100 }),
    getCreatorGuides({ limit: 3 }),
  ]);

  const openPlaces = openOnDays(places.data, weekendDays(window)).slice(0, PLACES_LIMIT);
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const dates = weekendTripDates(window);
  const planHref = `/trips/new?start=${dates.start}&end=${dates.end}&title=${encodeURIComponent(
    county ? t('tripTitleIn', { county: county.name }) : t('tripTitle'),
  )}`;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-10">
      <header className="flex flex-col gap-4 rounded-[2rem] bg-brand-900 px-5 py-8 text-white sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-300">
          {window.isNow ? t('happeningNow') : `${fmt.format(window.from)} – ${fmt.format(window.to)}`}
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
          {county ? t('titleIn', { county: county.name }) : t('title')}
        </h1>
        <p className="max-w-2xl text-white/80">{t('intro')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={planHref} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-sunset-600 px-5 text-sm font-bold text-white hover:bg-sunset-700">
            <CalendarDaysIcon aria-hidden className="h-5 w-5" />
            {t('planThisWeekend')}
          </Link>
          <form method="GET" className="flex items-center gap-2">
            <label htmlFor="weekend-county" className="sr-only">
              {t('county')}
            </label>
            <select
              id="weekend-county"
              name="county"
              defaultValue={county?.slug ?? ''}
              className="min-h-12 rounded-full border border-white/30 bg-white/10 px-4 text-sm font-semibold text-white [&>option]:text-slate-900"
            >
              <option value="">{t('allCounties')}</option>
              {counties.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="min-h-12 rounded-full border border-white/30 px-4 text-sm font-semibold hover:bg-white/10">
              {t('apply')}
            </button>
          </form>
        </div>
      </header>

      <section aria-labelledby="weekend-events" className="flex flex-col gap-5">
        <SectionHeading id="weekend-events" eyebrow={t('eventsEyebrow')} title={t('eventsTitle')} href="/events" linkLabel={t('allEvents')} />
        {events.data.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.data.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-[1.75rem] border border-dashed border-slate-300 p-5 dark:border-slate-700">
            <p className="text-slate-700 dark:text-slate-200">{county ? t('noEventsIn', { county: county.name }) : t('noEvents')}</p>
            <Link href="/events/new" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white">
              <PlusIcon aria-hidden className="h-4 w-4" />
              {t('listEvent')}
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="weekend-open" className="flex flex-col gap-5">
        <SectionHeading id="weekend-open" eyebrow={t('openEyebrow')} title={t('openTitle')} body={t('openBody')} />
        {openPlaces.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {openPlaces.map((place, i) => (
              <PlaceCardCompact key={place.id} place={place} index={i} />
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 rounded-[1.75rem] border border-dashed border-slate-300 p-5 text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <ClockIcon aria-hidden className="h-5 w-5 shrink-0" />
            {t('noOpenPlaces')}
          </p>
        )}
      </section>

      {guides.data.length > 0 && (
        <section aria-labelledby="weekend-guides" className="flex flex-col gap-5">
          <SectionHeading id="weekend-guides" eyebrow={t('guidesEyebrow')} title={t('guidesTitle')} href="/creator-guides" linkLabel={t('allGuides')} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guides.data.map((g) => (
              <li key={g.id}>
                <GuideCard guide={g} byLabel={t('byCreator', { name: g.creator.name })} placesLabel={t('placeCount', { count: g.stops.length })} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
