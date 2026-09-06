import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  BriefcaseIcon,
  MapIcon,
  TruckIcon,
  VideoCameraIcon,
  ViewfinderCircleIcon,
  ArrowRightIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { StarIcon, SparklesIcon } from '@heroicons/react/24/solid';
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
//
// Hero unification (Aug 27, 2026): the mock-up pass above only gave the
// rich navy treatment (gradient, decorative glow shapes, skyline, the
// "One simple flow" panel) to `lg:` and up — mobile fell back to a plain
// white section with dark text and no `dark:` variants at all, so it (a)
// looked flat next to every other section on the app's busiest, most
// screenshotted breakpoint, (b) broke outright in dark mode (a stark white
// band under the dark header), and (c) left the "Explore Map" pill's
// `border-white/30 bg-white/10` styling — written assuming a dark
// backdrop — nearly invisible against that white background. Making the
// navy hero unconditional fixes all three at once instead of needing a
// second, mobile-specific dark-mode treatment: it's a deliberately-colored
// surface (like the "Plan a weekend" banner further down) that looks
// intentional regardless of which site theme is active, the same reasoning
// that already applied at `lg:`.
//
// Events visibility fix (Aug 27, 2026): "Upcoming events" previously sat
// as a plain text list at the very bottom of the page, below the ad
// carousel — the least prominent spot here, and it silently rendered
// nothing at all whenever there were zero *approved* events on hand (see
// EventReviewStatus), which is most of the time on a freshly-seeded or
// low-traffic day. Replaced with EventCarousel — the same full-bleed
// snap-scroll carousel mechanism as AdvertisementBanner below it, applied
// to organic content instead of paid ads — and moved up to sit right
// after Trending Places: a co-equal discovery surface instead of a
// footnote nobody scrolled far enough to see.
//
// Hero decluttering (Aug 27, 2026): product feedback — "the information
// here is too [much]... move the search bar since there's a search bar
// at the top... give the user what the platform is about when they
// arrive." The Header carries its own persistent "Search" entry point, so
// the hero's full-width input directly beneath the tagline was pure
// duplication on the app's first screen; it's now a single-tap text link
// instead. The three separate stat chips (counties/categories/places)
// collapsed into one quiet line so they read as a footnote, not a fourth
// call to action. In their place: the site's own tagline ("Everything
// Liberia. One place.", previously sr-only in the Header) surfaced as a
// visible eyebrow so the very first thing a visitor reads answers "what
// is this", and a gradient treatment on "Liberia" in the headline for a
// bit of brand signature without a stock photo. Near Me/Explore Map keep
// their elevated co-primary spot per the review-readout pass above — they
// gained the room the search input used to take instead of losing it.
//
// Hero visual hook ("make it amazing" pass, Sep 3, 2026): the hero's right
// rail was a text-only "One simple flow" explainer of the exact three
// actions the search link and the two discovery pills right next to it
// already make obvious — worth trying once, but it was carrying none of
// the "wow, look at this place" weight a first screen should. Swapped for
// HeroPhotoMosaic: a small bento grid of real photos pulled from places
// already fetched below (trending + this week's popular picks) — no extra
// API call, and no violation of the app's "no stock photography" rule
// (see the layout-pass note below) since these are genuine catalog photos,
// not decorative filler. The three-step explainer collapses into one
// caption line under the grid instead of disappearing outright.
//
// Counties/categories decluttering (Sep 3, 2026): product feedback,
// reacting to a screenshot of this exact section on desktop — "why we
// have see more button and all the categories listed... it looks so off,
// bad user experience." Both CountyGrid and CategoryGrid already had a
// collapse mechanism, but each disabled it above a certain width
// (CountyGrid's "See more" was `sm:hidden`; CategoryGrid's cap literally
// became `Infinity` past `lg:`) — so on any real desktop viewport, all 15
// counties and 20+ categories rendered back to back, uncapped, in two
// visually-identical tile grids. Fixed at the source in each component:
// CountyGrid now always shows a fixed preview and leans on this section's
// own "View all" link (→ /counties) for the rest, since a second in-place
// expand control for the same list would just be a redundant escape
// hatch; CategoryGrid (no `/categories` browse-all page to link to
// instead) keeps its expand/collapse toggle, just no longer disables it
// above 1024px.
//
// Personalization ("make it amazing" pass, item 2/5, Sep 3, 2026): signup
// has collected traveler-type/interests since task #48/#49, unused until
// now. PersonalizedPicksSection (a client component — auth state here
// lives entirely in localStorage, see account/page.tsx) renders a "For
// you" rail keyed off the visitor's own interest categories, right where
// Featured Places already sits — curated for this specific visitor, not
// organic catalog activity like the sections past the "discovery starts
// here" divider below. Renders nothing for a signed-out visitor or one
// with no interests set, so this costs anonymous traffic nothing.
//
// Events re-ordering + motion cleanup (Aug 27, 2026): product feedback —
// "the event area should be the last section of the home page" (reversing
// the "Events visibility fix" placement above, now that the hero and the
// sections above it carry enough of their own discovery weight) and
// "remove this animation that's looking like breathing, it's not really
// professional" — the hero's bottom-left glow blob used `animate-float`,
// a slow infinite translateY drift shared with the splash screen's logo;
// fine as a one-time loading flourish, but looping indefinitely behind
// the page's primary content read as an unintentional distraction rather
// than a design choice. Dropped the animation and kept the blob itself
// (still a static soft-light accent, matching its top-right sibling,
// which was never animated). EventCarousel keeps its exact carousel
// mechanism — only its position in the page changed.
//
// Redesign pass (Sep 3, 2026): product feedback — "the blue looks light
// and a lot of things on the home page [compete] with attention." The
// color half of that is fixed at the source (see the palette rewrite in
// lib/category-colors.ts — the county/category icon badges and card
// placeholder gradients were a mismatched grab-bag of stock hues, not
// this page's own colors). The "too much competing for attention" half
// is a hierarchy problem, not a content problem: nothing here was cut,
// but eight sections of near-identical visual weight running back to
// back with no rhythm made the page read as one long undifferentiated
// scroll. Two changes: a `border-t` breathing point ahead of "Trending
// places" now marks where discovery content actually starts (after the
// two browse grids), and the "Add a place" CTA — previously stranded
// between Community Trips and the ad slot, competing with real content
// for attention — now sits with its actual peers, the Plan a Trip /
// Creators / Rent a car utility links, as one clearly-bounded "quick
// actions" cluster instead of four separate interruptions scattered
// through the scroll.
import { getActiveAdvertisements, getActiveSponsoredPlacements, getBusinesses, getCategories, getCounties, getEvents, getPlaces, getPublicTrips } from '@/lib/api';
import { PlaceCardCompact } from '@/components/PlaceCardCompact';
import { CategoryGrid } from '@/components/CategoryGrid';
import { CountyGrid } from '@/components/CountyGrid';
import { AdvertisementBanner } from '@/components/AdvertisementBanner';
import { EventCarousel } from '@/components/EventCarousel';
import { FeaturedDestinationCard } from '@/components/FeaturedDestinationCard';
import { PublicTripCard } from '@/components/PublicTripCard';
import { HeroPhotoMosaic } from '@/components/HeroPhotoMosaic';
import { PersonalizedPicksSection } from '@/components/PersonalizedPicksSection';

const TRENDING_PLACES_LIMIT = 10;
const DISCOVER_THIS_WEEK_LIMIT = 8;
const UPCOMING_EVENTS_LIMIT = 8;
const COMMUNITY_TRIPS_LIMIT = 6;

// Home screen: search bar, category shortcuts, trending places, near-you
// teaser, map entry point — per Tech Spec §4.1 screen inventory.
export default async function Home() {
  const [categories, counties, trending, discoverThisWeek, upcomingEvents, sponsoredPlacements, ads, businesses, communityTrips] = await Promise.all([
    getCategories(),
    getCounties(),
    getPlaces({ sort: 'featured', limit: TRENDING_PLACES_LIMIT }),
    // Retired the "Weekend Explorer" banner that used to sit here in favor
    // of this — real, current usage (sort=popular: view count over the
    // trailing 7 days, see PLACE_TRENDING_WINDOW_DAYS in places.service.ts)
    // rather than a fixed CTA to a feature most visitors never opened.
    getPlaces({ sort: 'popular', limit: DISCOVER_THIS_WEEK_LIMIT }),
    getEvents({ dateFrom: new Date().toISOString(), limit: UPCOMING_EVENTS_LIMIT }),
    getActiveSponsoredPlacements(),
    getActiveAdvertisements(),
    getBusinesses({ limit: 100 }),
    // Section 17's "surface public trips ... in feeds" — a small rail of
    // the most recently-created public trips, same source the /trips/community
    // page pulls its full list from.
    getPublicTrips({ limit: COMMUNITY_TRIPS_LIMIT }),
  ]);

  // Rollout order, not alphabetical — the first tab is the flagship county
  // (Greater Monrovia today) and gets the "active" underline treatment,
  // same honesty-about-rollout-stage convention as /counties. Sorted by
  // placeCount first, not just rolloutStage: two counties can share a
  // stage (e.g. an early pilot county alongside the real flagship), and
  // it's actual catalog depth — not the stage number — that makes one of
  // them the one worth leading with.
  const quickCounties = [...counties]
    .sort((a, b) => (b.placeCount ?? 0) - (a.placeCount ?? 0) || a.rolloutStage - b.rolloutStage);

  // Randomize the order on each uncached request so every active sponsored
  // placement gets a fair chance at the leading card while the responsive
  // grid keeps the rest visible rather than stretching one across the page.
  const featuredStart = sponsoredPlacements.length > 0 ? Math.floor(Math.random() * sponsoredPlacements.length) : 0;
  const featuredPlacements = [
    ...sponsoredPlacements.slice(featuredStart),
    ...sponsoredPlacements.slice(0, featuredStart),
  ];
  const businessVerificationByPlaceId = new Map(
    businesses.data.map((business) => [business.linkedPlaceId, business.verificationStatus]),
  );

  // Hero photo mosaic's showcase picks — reuses the trending/this-week
  // data already fetched above rather than a fifth API call. Places with
  // at least one real photo sort first so the mosaic reaches for genuine
  // imagery whenever the catalog has it; a place with none still renders
  // fine via HeroPhotoMosaic's own category-color fallback, so this never
  // needs to filter anything out.
  const heroShowcasePlaces = (() => {
    const seen = new Set<string>();
    const candidates = [...trending.data, ...discoverThisWeek.data].filter((place) => {
      if (seen.has(place.id)) return false;
      seen.add(place.id);
      return true;
    });
    return [...candidates]
      .sort((a, b) => (b.images.length > 0 ? 1 : 0) - (a.images.length > 0 ? 1 : 0))
      .slice(0, 4);
  })();

  return (
    <main className="mx-auto flex max-w-7xl flex-col">
      <section className="relative overflow-hidden rounded-b-[2rem] bg-gradient-to-br from-brand-800 via-brand-900 to-[#050b24] px-4 pb-8 pt-8 text-white shadow-[0_14px_36px_rgba(8,26,80,0.35)] animate-fade-in-up sm:px-6 lg:rounded-none lg:px-10 lg:pb-14 lg:pt-12">
        {/* Decorative depth — soft glow shapes, no imagery dependency.
            Unconditional now (previously lg:block-only, so the hero looked
            flat below that breakpoint) — sized down on small screens so
            they read as ambient light rather than crowding the card. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-32 w-32 rounded-full bg-gold-400/20 blur-3xl sm:h-40 sm:w-40 lg:h-48 lg:w-48"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -left-8 h-28 w-28 rounded-full bg-accent-400/20 blur-3xl sm:h-36 sm:w-36 lg:h-40 lg:w-40"
        />
        {/* Stylized night skyline standing in for the mock-up's photo — see
            the layout-pass note above for why there's no stock image here. */}
        <svg
          aria-hidden
          viewBox="0 0 400 60"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 w-full text-black/30 sm:h-14 lg:h-16"
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

        <div className="relative grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-12">
          <div className="max-w-2xl">
            {/* The site's own tagline (previously sr-only in the Header)
                surfaced as a visible eyebrow — the first thing a new
                visitor reads is a one-line answer to "what is this",
                reusing established brand copy instead of inventing new. */}
            <p className="inline-flex w-fit items-center rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400 sm:text-xs">
              Everything Liberia. One place.
            </p>
            <h1 className="mt-3 max-w-xl font-display text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
              Discover <span className="text-gold-400">Liberia</span>.<br />Find your next place.
            </h1>
          <p className="max-w-xl text-brand-100 sm:text-lg sm:leading-7">
            Real places, real reviews — across all 15 counties.
          </p>

          {/* Co-primary discovery tools, front and center with nothing
              competing above them. The hero's own search input was dropped
              here — the Header already carries a persistent Search entry
              point, so repeating a full-width input directly beneath it
              was pure duplication; a lightweight link below still gets
              people there in one tap. See the review readout comment above
              for why Near Me/Explore are elevated over a buried footer link. */}
          <div className="grid grid-cols-2 gap-3 pt-5 sm:max-w-xl">
            <Link
              href="/near-me"
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-accent-300/50 bg-accent-600 px-4 py-3 text-sm font-semibold shadow-lg transition-colors hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              <ViewfinderCircleIcon aria-hidden className="h-5 w-5 text-white" />
              Near Me
            </Link>
            <Link
              href="/explore"
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold transition-colors hover:border-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <MapIcon aria-hidden className="h-5 w-5" />
              Explore Map
            </Link>
          </div>

          <Link
            href="/search"
            className="mt-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-100 transition-colors hover:text-white"
          >
            <MagnifyingGlassIcon aria-hidden className="h-4 w-4" />
            Search for something specific
            <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
          </Link>

          {/* Quick credibility signal — real counts from this same
              request, not marketing copy, so it never claims more than the
              catalog actually has. Condensed from three separate chips into
              one quiet line so it reads as a footnote, not a fourth CTA. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-5 text-xs font-medium text-brand-200/80 sm:text-sm">
            <span>{counties.length} counties</span>
            <span aria-hidden>·</span>
            <span>{categories.length}+ categories</span>
            <span aria-hidden>·</span>
            <span>{trending.meta.total}+ places</span>
          </div>
          </div>
          {heroShowcasePlaces.length > 0 && (
            <aside className="hidden flex-col gap-4 lg:flex">
              <HeroPhotoMosaic places={heroShowcasePlaces} />
              <div className="text-center">
                <p className="font-display text-base font-semibold text-white">Real places, ready to explore</p>
                <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-brand-100">
                  Search, explore, and save what matters — starting with what other travelers are already discovering.
                </p>
              </div>
            </aside>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {quickCounties.length > 0 && (
          <section aria-labelledby="counties-heading" className="hidden flex-col gap-3 lg:flex">
            <div className="flex items-center justify-between gap-3">
              <h2 id="counties-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">Browse counties</h2>
              <Link href="/counties" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex dark:text-brand-300">
                View all <ArrowRightIcon aria-hidden className="h-4 w-4" />
              </Link>
            </div>
            <CountyGrid counties={quickCounties} />
          </section>
        )}

        <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
          <h2 id="categories-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
            Browse categories
          </h2>
          <CategoryGrid categories={categories} />
        </section>

        {featuredPlacements.length > 0 && (
          <section aria-labelledby="featured-heading" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2
                id="featured-heading"
                className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
              >
                <StarIcon aria-hidden className="h-5 w-5 text-gold-500" />
                Featured Places
              </h2>
              {featuredPlacements.length > 1 && (
                <Link
                  href="/featured"
                  className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
                >
                  View all
                  <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featuredPlacements.map((placement) => (
                <FeaturedDestinationCard
                  key={placement.id}
                  place={placement.place}
                  verificationStatus={businessVerificationByPlaceId.get(placement.place.id)}
                />
              ))}
            </div>
          </section>
        )}

        <PersonalizedPicksSection businessVerificationByPlaceId={businessVerificationByPlaceId} />

        <section aria-labelledby="trending-heading" className="flex flex-col gap-3 border-t border-slate-100 pt-8 dark:border-slate-800/70">
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {trending.data.map((place, i) => (
              <PlaceCardCompact
                key={place.id}
                place={place}
                verificationStatus={businessVerificationByPlaceId.get(place.id)}
                index={i}
              />
            ))}
          </div>
        </section>

        {communityTrips.data.length > 0 && (
          <section aria-labelledby="community-trips-heading" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 id="community-trips-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
                Trips you can join
              </h2>
              <Link
                href="/trips/community"
                className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
              >
                See all
                <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {communityTrips.data.map((trip) => (
                <div key={trip.id} className="w-64 shrink-0 sm:w-72">
                  <PublicTripCard trip={trip} />
                </div>
              ))}
            </div>
          </section>
        )}

        <AdvertisementBanner ads={ads} />

        {/* Replaces the retired "Weekend Explorer" banner that used to live
            here — a fixed CTA to a feature most visitors never opened, in
            favor of a real-data discovery surface: whatever's actually
            getting looked at right now. */}
        <section aria-labelledby="discover-week-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2
              id="discover-week-heading"
              className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
            >
              <SparklesIcon aria-hidden className="h-5 w-5 text-gold-500" />
              Discover this week
            </h2>
            <Link
              href="/search"
              className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              See all
              <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {discoverThisWeek.data.map((place, i) => (
              <PlaceCardCompact
                key={place.id}
                place={place}
                verificationStatus={businessVerificationByPlaceId.get(place.id)}
                index={i}
              />
            ))}
          </div>
        </section>

        {/* Quick actions cluster: "Add a place" used to sit stranded between
            Community Trips and the ad slot — a fourth unrelated
            interruption competing with actual content instead of reading
            as part of a group. Grouped here with its real peers (Plan a
            Trip / Creators / Rent a car — all secondary utility links, not
            discovery surfaces) demoted from full-bleed gradient banners
            (still useful, but not "discovery" the way search/Near Me/the
            map are — see the review readout comment at the top of this
            file) into one clearly-bounded, quieter section instead of four
            separate interruptions scattered through the scroll. */}
        <div className="flex flex-col gap-3 border-t border-slate-100 pt-8 dark:border-slate-800/70">
          <Link
            href="/places/submit"
            className="group flex items-center gap-4 rounded-3xl border border-dashed border-brand-300 bg-white p-4 text-brand-900 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-card-hover dark:border-brand-700 dark:bg-slate-900 dark:text-slate-50"
          >
            <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition-transform group-hover:scale-105">
              <PlusIcon className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-bold">Add a place</span>
              <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">Help others discover great places in Liberia.</span>
            </span>
            <ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0 text-brand-700 transition-transform group-hover:translate-x-1" />
          </Link>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/trips/new"
            className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-card"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Plan a Trip</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">Pick your dates and destination — add places as you go</p>
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

          <Link
            href="/car-rentals"
            className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-card sm:col-span-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Rent a car for your trip</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">Hire a vehicle, with or without a driver, from a local operator</p>
            </div>
            <TruckIcon
              aria-hidden
              className="h-6 w-6 shrink-0 text-accent-600 transition-transform duration-300 group-hover:scale-110 dark:text-accent-400"
            />
          </Link>
          </div>
        </div>

        <EventCarousel events={upcomingEvents.data} />
      </div>
    </main>
  );
}
