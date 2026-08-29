import Link from 'next/link';
import { getCounties, getEvents } from '@/lib/api';
import { EventFilters } from '@/components/EventFilters';
import { EventFeedCard } from '@/components/EventFeedCard';
import { EventCarousel } from '@/components/EventCarousel';
import type { EventCategory } from '@/lib/types';

// How many events the "Featured events" shelf shows — same shelf-size
// reasoning as Home's own carousel (UPCOMING_EVENTS_LIMIT in page.tsx):
// enough to make the horizontal scroll worthwhile without fetching more
// than a discovery ribbon needs.
const FEATURED_EVENTS_LIMIT = 8;

export const metadata = { title: 'Events — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Events listing (Tech Spec §3.2 / §5 Event) — upcoming-first (the API
// sorts by startDate ASC), filterable by category, county, and a date
// range (see EventFilters' quick-filter buttons for the dateFrom/dateTo
// values these come from).
export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const category = first(params.category) as EventCategory | undefined;
  const county = first(params.county);
  const dateFrom = first(params.dateFrom);
  const dateTo = first(params.dateTo);
  const page = Number(first(params.page) ?? '1') || 1;

  // The "Featured events" shelf is a discovery ribbon independent of
  // whatever filter/page the visitor is looking at below it — same
  // "top upcoming, unfiltered" set Home's own carousel shows — so it
  // only needs fetching on an unfiltered first landing, not on every
  // filtered/paginated request for the list beneath it.
  const showFeatured = !category && !county && !dateFrom && !dateTo && page === 1;

  const [counties, result, featured] = await Promise.all([
    getCounties(),
    getEvents({ category, county, dateFrom, dateTo, page, limit: 20 }),
    showFeatured
      ? getEvents({ dateFrom: new Date().toISOString(), limit: FEATURED_EVENTS_LIMIT })
      : Promise.resolve(null),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (county) p.set('county', county);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    p.set('page', String(targetPage));
    return `/events?${p.toString()}`;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">LIBERIA360 events</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">Events</h1>
        </div>
        <Link
          href="/events/new"
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
        >
          + Post an event
        </Link>
      </div>

      {featured && featured.data.length > 0 && (
        <EventCarousel events={featured.data} title="Featured events" seeAllHref={null} />
      )}

      <EventFilters counties={counties} />

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No upcoming events match these filters.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {result.data.map((event) => (
            <EventFeedCard key={event.id} event={event} />
          ))}
        </div>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 dark:text-brand-300 hover:underline'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= result.meta.totalPages}
            className={`text-sm font-medium ${
              page >= result.meta.totalPages ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 dark:text-brand-300 hover:underline'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
