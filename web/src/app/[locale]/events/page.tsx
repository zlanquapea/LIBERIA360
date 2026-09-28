import Link from "next/link";
import { getCounties, getUpcomingEvents } from "@/lib/api";
import { EventFilters } from "@/components/EventFilters";
import { EventFeedCard } from "@/components/EventFeedCard";
import { EventCarousel } from "@/components/EventCarousel";
import type { EventCategory } from "@/lib/types";
import {
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

// How many events the "Featured events" shelf shows — same shelf-size
// reasoning as Home's own carousel (UPCOMING_EVENTS_LIMIT in page.tsx):
// enough to make the horizontal scroll worthwhile without fetching more
// than a discovery ribbon needs.
const FEATURED_EVENTS_LIMIT = 8;

export const metadata = { title: "Events — LIBERIA360" };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Events listing (Tech Spec §3.2 / §5 Event) — upcoming-first (the API
// sorts by startDate ASC), filterable by category, county, and a date
// range (see EventFilters' quick-filter buttons for the dateFrom/dateTo
// values these come from).
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const category = first(params.category) as EventCategory | undefined;
  const search = first(params.search)?.trim().slice(0, 100);
  const county = first(params.county);
  const dateFrom = first(params.dateFrom);
  const dateTo = first(params.dateTo);
  const page = Number(first(params.page) ?? "1") || 1;
  const hasFilters = Boolean(
    search || category || county || dateFrom || dateTo,
  );

  // The "Featured events" shelf is a discovery ribbon independent of
  // whatever filter/page the visitor is looking at below it — same
  // "top upcoming, unfiltered" set Home's own carousel shows — so it
  // only needs fetching on an unfiltered first landing, not on every
  // filtered/paginated request for the list beneath it.
  const showFeatured =
    !search && !category && !county && !dateFrom && !dateTo && page === 1;

  const [counties, result, featured] = await Promise.all([
    getCounties(),
    getUpcomingEvents({
      search,
      category,
      county,
      dateFrom,
      dateTo,
      page,
      limit: 20,
    }),
    showFeatured
      ? getUpcomingEvents({ limit: FEATURED_EVENTS_LIMIT })
      : Promise.resolve(null),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (category) p.set("category", category);
    if (county) p.set("county", county);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    p.set("page", String(targetPage));
    return `/events?${p.toString()}`;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 pb-28 sm:px-6 sm:py-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Events
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
            Discover what’s happening across Liberia.
          </p>
        </div>
        <Link
          href="/events/new"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-brand-800 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-200"
        >
          <PlusIcon aria-hidden className="h-4 w-4" /> Post an event
        </Link>
      </header>

      <section
        aria-label="Find events"
        className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
      >
        <form action="/events" method="GET" className="flex gap-2">
          {Object.entries({ category, county, dateFrom, dateTo }).map(
            ([name, value]) =>
              value ? (
                <input key={name} type="hidden" name={name} value={value} />
              ) : null,
          )}
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 focus-within:ring-2 focus-within:ring-brand-500 dark:bg-slate-950">
            <MagnifyingGlassIcon
              aria-hidden
              className="h-4 w-4 shrink-0 text-slate-400"
            />
            <input
              name="search"
              type="search"
              defaultValue={search}
              placeholder="Search events or places"
              aria-label="Search events or locations"
              className="min-h-12 min-w-0 w-full bg-transparent text-base outline-none sm:text-sm"
            />
          </label>
          <button
            type="submit"
            className="min-h-12 shrink-0 rounded-xl bg-brand-800 px-4 text-sm font-semibold text-white hover:bg-brand-900 focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            Search
          </button>
        </form>

        <EventFilters counties={counties} />
      </section>

      {featured && featured.data.length > 0 && (
        <EventCarousel
          events={featured.data}
          title="Featured events"
          seeAllHref={null}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          {hasFilters ? "Search results" : "Upcoming events"}
        </h2>
        {hasFilters && (
          <Link
            href="/events"
            className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
          >
            Reset filters
          </Link>
        )}
      </div>

      {result.data.length === 0 ? (
        <section
          className="rounded-2xl border border-slate-200 bg-white px-6 py-9 text-center dark:border-slate-800 dark:bg-slate-900"
          aria-label="No events"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200">
            <CalendarDaysIcon aria-hidden className="h-6 w-6" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
            {hasFilters
              ? "No events match your search"
              : "More events are on the way"}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">
            {hasFilters
              ? "Try another date, category, or county to see what’s happening."
              : "There are no upcoming events listed right now. Hosting something? Share it with the community."}
          </p>
          <Link
            href={hasFilters ? "/events" : "/events/new"}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            {hasFilters ? "Clear filters" : "Post an event"}
          </Link>
        </section>
      ) : (
        <div className="flex flex-col gap-4">
          {result.data.map((event, i) => (
            <EventFeedCard key={event.id} event={event} index={i} />
          ))}
        </div>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? "pointer-events-none text-slate-300 dark:text-slate-700" : "text-brand-700 dark:text-brand-300 hover:underline"}`}
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
              page >= result.meta.totalPages
                ? "pointer-events-none text-slate-300 dark:text-slate-700"
                : "text-brand-700 dark:text-brand-300 hover:underline"
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
