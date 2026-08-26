import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  BriefcaseIcon,
  MapIcon,
  VideoCameraIcon,
  ViewfinderCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon, SunIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
// Product review readout (Aug 25, 2026), "homepage hierarchy": "the
// homepage currently has too many things competing for attention... I
// would make search and discovery the primary focus," plus specifically
// "the Near Me feature is potentially one of the strongest parts of the
// platform — I would make it much more prominent" and "the map should
// also become a core feature rather than just another section." This
// page keeps every existing section (nothing was cut) but re-orders and
// re-weights them: search stays first, Near Me and the map move directly
// beneath it as co-equal primary discovery tools, and the Trip
// Planner/Creators promos — genuinely useful, but not "discovery" in the
// same sense — are demoted to a visually quieter, more compact pairing
// further down instead of two full-bleed gradient banners competing with
// everything above them.
//
// Layout pass (Aug 26, 2026): re-shaped around a provided mock-up — a
// full-bleed dark hero (search + the two discovery pills live inside it,
// not below it), a county quick-nav row, a 4-column category grid instead
// of a horizontal scroll shelf, and a single primary "Plan a weekend"
// banner in place of the old bare text link. No stock photo behind the
// hero (the app has stayed image-dependency-free everywhere else, e.g.
// PlaceCard's category-color fallback) — a small inline skyline-at-night
// SVG stands in for the mock-up's photo, same mood without an asset.
import { getActiveAdvertisements, getActiveSponsoredPlacements, getCategories, getCounties, getEvents, getPlaces } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { PlaceCardCompact } from '@/components/PlaceCardCompact';
import { CategoryGrid } from '@/components/CategoryGrid';
import { AdvertisementBanner } from '@/components/AdvertisementBanner';
import { formatEventDateRange } from '@/lib/format';

const TRENDING_PLACES_LIMIT = 10;

// Home screen: search bar, category shortcuts, trending places, near-you
// teaser, map entry point — per Tech Spec §4.1 screen inventory.
export default async function Home() {
  const [categories, counties, trending, upcomingEvents, sponsoredPlacements, ads] = await Promise.all([
    getCategories(),
    getCounties(),
    getPlaces({ sort: 'featured', limit: TRENDING_PLACES_LIMIT }),
    getEvents({ dateFrom: new Date().toISOString(), limit: 3 }),
    getActiveSponsoredPlacements(),
    getActiveAdvertisements(),
  ]);

  // Rollout order, not alphabetical — the first tab is the flagship county
  // (Greater Monrovia today) and gets the "active" underline treatment,
  // same honesty-about-rollout-stage convention as /counties. Sorted by
  // placeCount first, not just rolloutStage: two counties can share a
  // stage (e.g. an early pilot county alongside the real flagship), and
  // it's actual catalog depth — not the stage number — that makes one of
  // them the one worth leading with.
  const quickCounties = [...counties]
    .sort((a, b) => (b.placeCount ?? 0) - (a.placeCount ?? 0) || a.rolloutStage - b.rolloutStage)
    .slice(0, 5);

  return (
    <main className="mx-auto flex max-w-3xl flex-col">
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-800 via-brand-900 to-brand-900 px-4 pb-8 pt-6 text-white animate-fade-in-up">
        {/* Decorative depth — soft glow shapes, no imagery dependency */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -left-8 h-40 w-40 animate-float rounded-full bg-accent-400/20 blur-3xl"
        />
        {/* Stylized night skyline standing in for the mock-up's photo — see
            the layout-pass note above for why there's no stock image here. */}
        <svg
          aria-hidden
          viewBox="0 0 400 60"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full text-black/30"
        >
          <rect x="0" y="30" width="18" height="30" fill="currentColor" />
          <rect x="22" y="20" width="14" height="40" fill="currentColor" />
          <rect x="40" y="36" width="20" height="24" fill="currentColor" />
          <rect x="64" y="12" width="16" height="48" fill="currentColor" />
          <rect x="84" y="26" width="22" height="34" fill="currentColor" />
          <rect x="110" y="38" width="14" height="22" fill="currentColor" />
          <rect x="128" y="18" width="18" height="42" fill="currentColor" />
          <rect x="150" y="32" width="24" height="28" fill="currentColor" />
          <rect x="178" y="10" width="16" height="50" fill="currentColor" />
          <rect x="198" y="28" width="20" height="32" fill="currentColor" />
          <rect x="222" y="40" width="14" height="20" fill="currentColor" />
          <rect x="240" y="16" width="18" height="44" fill="currentColor" />
          <rect x="262" y="34" width="22" height="26" fill="currentColor" />
          <rect x="288" y="22" width="16" height="38" fill="currentColor" />
          <rect x="308" y="38" width="20" height="22" fill="currentColor" />
          <rect x="332" y="14" width="14" height="46" fill="currentColor" />
          <rect x="350" y="30" width="24" height="30" fill="currentColor" />
          <rect x="378" y="22" width="22" height="38" fill="currentColor" />
          <g fill="#ffc63d" opacity="0.7">
            <circle cx="30" cy="32" r="1.4" />
            <circle cx="92" cy="36" r="1.4" />
            <circle cx="186" cy="24" r="1.4" />
            <circle cx="266" cy="40" r="1.4" />
            <circle cx="360" cy="34" r="1.4" />
          </g>
        </svg>

        <div className="relative flex flex-col gap-3">
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Everything Liberia. One Place.</h1>
          <p className="text-brand-100">
            Discover destinations, food, and stays across all 15 counties — starting with Greater Monrovia.
          </p>
          <form
            action="/search"
            method="GET"
            className="flex items-center overflow-hidden rounded-full bg-white dark:bg-slate-900 shadow-lg ring-1 ring-black/5 transition-shadow focus-within:ring-2 focus-within:ring-gold-400"
          >
            <input
              type="search"
              name="q"
              placeholder="What are you looking for?"
              className="w-full px-4 py-2.5 text-sm text-slate-900 dark:text-slate-50 outline-none"
            />
            <button
              type="submit"
              aria-label="Search"
              className="m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white transition-colors hover:bg-accent-600"
            >
              <MagnifyingGlassIcon aria-hidden className="h-5 w-5" />
            </button>
          </form>

          {/* Co-primary discovery tools, inside the hero right under search —
              see the review readout comment above for why these are
              elevated instead of buried at the bottom of the page. */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Link
              href="/near-me"
              className="flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-4 py-2.5 text-sm font-medium transition-colors hover:border-gold-400 hover:bg-white/10"
            >
              <ViewfinderCircleIcon aria-hidden className="h-5 w-5 text-gold-400" />
              Near Me
            </Link>
            <Link
              href="/explore"
              className="flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/5 px-4 py-2.5 text-sm font-medium transition-colors hover:border-white/70 hover:bg-white/10"
            >
              <MapIcon aria-hidden className="h-5 w-5" />
              Explore Map
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-8 px-4 py-6">
        {quickCounties.length > 0 && (
          <nav aria-label="Browse by county" className="-mx-4 flex items-center gap-5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-4">
            {quickCounties.map((county, i) => (
              <Link
                key={county.id}
                href={`/counties/${county.slug}`}
                className={`shrink-0 whitespace-nowrap border-b-2 pb-2 pt-1 text-sm transition-colors ${
                  i === 0
                    ? 'border-accent-500 font-semibold text-slate-900 dark:text-slate-50'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
              >
                {county.name}
              </Link>
            ))}
            <Link
              href="/counties"
              className="ml-auto flex shrink-0 items-center gap-0.5 whitespace-nowrap pb-2 pt-1 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              See all
              <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </nav>
        )}

        <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
          <h2 id="categories-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
            Browse categories
          </h2>
          <CategoryGrid categories={categories} />
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

        <AdvertisementBanner ads={ads} />

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
          <div className="grid grid-cols-2 gap-3">
            {trending.data.map((place) => (
              <PlaceCardCompact key={place.id} place={place} />
            ))}
          </div>
        </section>

        {/* Primary trip-planning CTA, styled after the mock-up's banner —
            the actual "Weekend Explorer" feature (previously a bare text
            link at the bottom of the page). */}
        <Link
          href="/trips/weekend/new"
          className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 p-3 text-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
        >
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gold-400/20 ring-1 ring-gold-400/40"
          >
            <SunIcon aria-hidden className="h-7 w-7 text-gold-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-semibold">Plan a weekend</p>
            <p className="truncate text-sm text-brand-100">Discover places to stay, eat, and explore across Liberia.</p>
          </div>
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500 transition-transform duration-300 group-hover:translate-x-0.5"
          >
            <ChevronRightIcon aria-hidden className="h-4 w-4 text-white" />
          </span>
        </Link>

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
      </div>
    </main>
  );
}
