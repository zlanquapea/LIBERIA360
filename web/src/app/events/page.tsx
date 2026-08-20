import Link from 'next/link';
import { getCounties, getEvents } from '@/lib/api';
import { formatEventCategory, formatEventDateRange } from '@/lib/format';
import { EventFilters } from '@/components/EventFilters';
import type { EventCategory } from '@/lib/types';

export const metadata = { title: 'Events — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Events listing (Tech Spec §3.2 / §5 Event) — upcoming-first (the API
// sorts by startDate ASC), filterable by category and county.
export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const category = first(params.category) as EventCategory | undefined;
  const county = first(params.county);
  const page = Number(first(params.page) ?? '1') || 1;

  const [counties, result] = await Promise.all([
    getCounties(),
    getEvents({ category, county, page, limit: 20 }),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (category) p.set('category', category);
    if (county) p.set('county', county);
    p.set('page', String(targetPage));
    return `/events?${p.toString()}`;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Events</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Concerts, festivals, sports, and more — across Liberia.</p>
        </div>
        <Link
          href="/events/new"
          className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700"
        >
          + Post an event
        </Link>
      </div>

      <EventFilters counties={counties} />

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          No upcoming events match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:border-brand-500"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 dark:text-slate-50">{event.name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{formatEventDateRange(event.startDate, event.endDate)}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {event.place?.name ?? event.locationText} · {event.county.name} County
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {formatEventCategory(event.category)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 hover:underline'}`}
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
              page >= result.meta.totalPages ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 hover:underline'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
