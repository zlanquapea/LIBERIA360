import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  BriefcaseIcon,
  MapIcon,
  VideoCameraIcon,
  ViewfinderCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
// Product review readout (Aug 25, 2026), "homepage hierarchy": "the
// homepage currently has too many things competing for attention... I
// would make search and discovery the primary focus," plus specifically
// "the Near Me feature is potentially one of the strongest parts of the
// platform — I would make it much more prominent" and "the map should
// also become a core feature rather than just another section." This
// page keeps every existing section (nothing was cut) but re-orders and
// re-weights them: search stays first, Near Me and the map move directly
// beneath it as co-equal primary discovery tools (previously Near Me was
// a single plain link at the very bottom of the page), and the Trip
// Planner/Creators promos — genuinely useful, but not "discovery" in the
// same sense — are demoted to a visually quieter, more compact pairing
// further down instead of two full-bleed gradient banners competing with
// everything above them.
import { getActiveSponsoredPlacements, getCategories, getEvents, getPlaces } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { formatEventDateRange } from '@/lib/format';
import { CategoryIcon } from '@/lib/icons';

// Home screen: search bar, category shortcuts, trending places, near-you
// teaser, map entry point — per Tech Spec §4.1 screen inventory.
export default async function Home() {
  const [categories, trending, upcomingEvents, sponsoredPlacements] = await Promise.all([
    getCategories(),
    getPlaces({ sort: 'featured', limit: 6 }),
    getEvents({ dateFrom: new Date().toISOString(), limit: 3 }),
    getActiveSponsoredPlacements(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 text-white shadow-card animate-fade-in-up">
        {/* Decorative depth — soft glow shapes, no imagery dependency */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 animate-float rounded-full bg-accent-400/20 blur-3xl"
        />
        <div className="relative flex flex-col gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Everything Liberia. One Place.</h1>
          <p className="text-brand-100">
            Discover destinations, food, and stays across all 15 counties — starting with Greater Monrovia.
          </p>
          <form
            action="/search"
            method="GET"
            className="flex overflow-hidden rounded-full bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black/5 transition-shadow focus-within:ring-2 focus-within:ring-gold-400"
          >
            <input
              type="search"
              name="q"
              placeholder="Search places, food, activities..."
              className="w-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-50 outline-none"
            />
            <button
              type="submit"
              className="flex items-center px-4 text-brand-700 dark:text-brand-300 transition-colors hover:bg-brand-50"
              aria-label="Search"
            >
              <MagnifyingGlassIcon aria-hidden className="h-5 w-5" />
            </button>
          </form>
        </div>
      </section>

      {/* Co-primary discovery tools, right under search — see the review
          readout comment above for why these moved here from the bottom
          of the page. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/near-me"
          className="group flex items-center justify-between rounded-2xl border-2 border-gold-400 bg-white dark:bg-slate-900 px-5 py-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-gold-600 hover:shadow-card-hover"
        >
          <div>
            <p className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">Near Me</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Restaurants, hotels, and more close to you right now</p>
          </div>
          <ViewfinderCircleIcon
            aria-hidden
            className="h-9 w-9 shrink-0 text-gold-600 transition-transform duration-300 group-hover:scale-110"
          />
        </Link>

        <Link
          href="/explore"
          className="group flex items-center justify-between rounded-2xl border-2 border-brand-400 bg-white dark:bg-slate-900 px-5 py-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-card-hover dark:border-brand-700"
        >
          <div>
            <p className="font-display text-lg font-semibold text-slate-800 dark:text-slate-100">Explore the map</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">Every place, color-coded by category</p>
          </div>
          <MapIcon
            aria-hidden
            className="h-9 w-9 shrink-0 text-brand-600 transition-transform duration-300 group-hover:scale-110 dark:text-brand-400"
          />
        </Link>
      </div>

      <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
        <h2 id="categories-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
          Browse by category
        </h2>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card"
            >
              <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-6 w-6 text-brand-600 dark:text-brand-300" />
              <span className="whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-200">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {sponsoredPlacements.length > 0 && (
        <section aria-labelledby="featured-heading" className="flex flex-col gap-3">
          <h2
            id="featured-heading"
            className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            <StarIcon aria-hidden className="h-5 w-5 text-gold-500" />
            Featured this week
          </h2>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
            {sponsoredPlacements.map((placement) => (
              <div key={placement.id} className="w-64 shrink-0">
                <PlaceCard place={placement.place} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="trending-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="trending-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
            Trending places
          </h2>
          <Link
            href="/search"
            className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
          >
            See all
            <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {trending.data.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      </section>

      {/* Demoted from full-bleed gradient banners (still useful, but not
          "discovery" the way search/Near Me/the map are — see the review
          readout comment at the top of this file) to a compact, quieter
          pairing further down the page. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/trips/new"
          className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-card"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Build My Liberia Trip</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">Days, interests, budget — we&apos;ll plan the route</p>
          </div>
          <BriefcaseIcon
            aria-hidden
            className="h-6 w-6 shrink-0 text-accent-600 transition-transform duration-300 group-hover:scale-110 dark:text-accent-400"
          />
        </Link>

        <Link
          href="/creators"
          className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-card"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Meet Liberia&apos;s creators</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">Videos, photos, and guides from local storytellers</p>
          </div>
          <VideoCameraIcon
            aria-hidden
            className="h-6 w-6 shrink-0 text-accent-600 transition-transform duration-300 group-hover:scale-110 dark:text-accent-400"
          />
        </Link>
      </div>

      <Link
        href="/trips/weekend/new"
        className="-mt-1 text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
      >
        Or plan a Weekend Explorer trip from where you are →
      </Link>

      {upcomingEvents.data.length > 0 && (
        <section aria-labelledby="events-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="events-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
              Upcoming events
            </h2>
            <Link
              href="/events"
              className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              See all
              <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {upcomingEvents.data.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/events/${event.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-50">{event.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatEventDateRange(event.startDate, event.endDate)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
