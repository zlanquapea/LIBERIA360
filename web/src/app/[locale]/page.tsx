import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  BeakerIcon,
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
//
// Hero "first impression" rebuild (Sep 2026): direct product feedback on
// a screenshot of the section above — "the first section of the home
// page is noisy... use a beautiful background image, animate things...
// wow people when they just arrive." Three changes, all scoped to the
// hero:
//
// 1. A real, functional search bar is back directly under the headline —
//    a deliberate reversal of the "hero decluttering" pass above,
//    which replaced it with a text link on the reasoning that the
//    Header's own persistent search made a second input redundant. That
//    reasoning didn't survive this feedback: a plain GET form (no client
//    JS, submits straight to /search?q=...) rather than a client
//    component, since a text input posting to a known route needs none.
// 2. The right-column HeroPhotoMosaic (a bento grid of dynamically
//    -selected catalog photos) is gone, replaced by a full-bleed
//    animated background behind the *entire* hero. Deliberately NOT
//    reusing the dynamic-catalog-photo approach for this: OnboardingTour
//    already tried exactly that pattern for a similar "wow" moment and
//    walked it back (see that component's own doc comment) because
//    catalog photos "read poorly" and didn't match the moment they were
//    meant to sell. This reuses OnboardingTour's fix instead — the same
//    three static, product-supplied real Liberia photos already bundled
//    under public/onboarding/ — as a slow-crossfade Ken-Burns background
//    (HeroBackground below), so the "no stock photography" rule (see the
//    layout-pass note above) still holds: these are genuine, previously
//    approved photos of Liberia, not purchased stock.
// 3. The stats footnote's "15 counties" swapped for a real "join N
//    travelers" count (GET /users/stats, public, soft-deleted accounts
//    excluded — see UsersService.countActive) — a rollout-stage number
//    like counties-covered undersold a maturing platform; a growing
//    user count says "people are already here" instead.
//
// The entrance itself stays a one-time staggered fade/slide-in
// (animate-fade-in-up per element, increasing delay) rather than
// anything looping — the "Events re-ordering + motion cleanup" pass
// above already had this exact fight once (`animate-float`'s infinite
// drift read as "breathing," not professional) and HeroBackground's own
// Ken-Burns motion is a deliberately slower, cinematic cadence, not a
// repeat of that mistake.
import { getActiveAdvertisements, getActiveSponsoredPlacements, getBusinesses, getCategories, getCounties, getEvents, getPlaces, getPlatformStats, getPublicTrips } from '@/lib/api';
import { PlaceCardCompact } from '@/components/PlaceCardCompact';
import { CategoryGrid } from '@/components/CategoryGrid';
import { CountyGrid } from '@/components/CountyGrid';
import { AdvertisementBanner } from '@/components/AdvertisementBanner';
import { EventCarousel } from '@/components/EventCarousel';
import { FeaturedPlacementsCarousel } from '@/components/FeaturedPlacementsCarousel';
import { PublicTripCard } from '@/components/PublicTripCard';
import { HeroBackground } from '@/components/HeroBackground';
import { PersonalizedPicksSection } from '@/components/PersonalizedPicksSection';
import { getTranslations } from 'next-intl/server';

const TRENDING_PLACES_LIMIT = 10;
const DISCOVER_THIS_WEEK_LIMIT = 8;
const UPCOMING_EVENTS_LIMIT = 8;
const COMMUNITY_TRIPS_LIMIT = 6;

// Home screen: search bar, category shortcuts, trending places, near-you
// teaser, map entry point — per Tech Spec §4.1 screen inventory.
//
// i18n Phase 3 (I18N_PLAN.md): a plain `getTranslations` call (not scoped
// to a namespace) is used below so this one Server Component can pull
// from both `home` (its own copy) and `nav`/`common` (a few strings this
// page reuses rather than duplicating, e.g. "Near Me" and "View all").
export default async function Home() {
  const t = await getTranslations();
  const [categories, counties, trending, discoverThisWeek, upcomingEvents, sponsoredPlacements, ads, businesses, communityTrips, platformStats] = await Promise.all([
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
    // Hero stats line's "join N travelers" — see the hero rebuild doc
    // comment above for why this replaced the counties-covered count.
    getPlatformStats(),
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

  return (
    <main className="mx-auto flex max-w-7xl flex-col">
      <section className="relative isolate overflow-hidden rounded-b-[2rem] px-4 pb-10 pt-10 text-white shadow-[0_14px_36px_rgba(0,47,59,0.35)] sm:px-6 sm:pb-12 sm:pt-14 lg:rounded-none lg:px-10 lg:pb-20 lg:pt-20">
        <HeroBackground />
        {/* A gradient scrim over the photos below, not a flat fill — dark
            enough at the bottom-left (where the text sits) to guarantee
            legibility against any of the three photos, sheer enough at the
            top-right to still read as "a real place", not just a dark
            panel with a photo behind it. Matches the app's existing navy
            brand gradient so it stays recognizably *this* app's hero
            rather than a generic photo banner. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#001f26] via-brand-900/85 to-brand-800/40"
        />
        {/* Ambient glow accents, kept from the pre-photo hero — still read
            as intentional brand color on top of a photo, same as they did
            on the flat gradient. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -end-10 -top-16 h-32 w-32 rounded-full bg-gold-400/25 blur-3xl sm:h-40 sm:w-40 lg:h-48 lg:w-48"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-6 -start-8 h-28 w-28 rounded-full bg-accent-400/25 blur-3xl sm:h-36 sm:w-36 lg:h-40 lg:w-40"
        />

        {/* One-time staggered entrance, not a loop — see the doc comment
            above the imports for why this deliberately isn't another
            `animate-float`. Each element's own `animate-fade-in-up` fires
            with an increasing delay so the section builds top-to-bottom
            instead of popping in all at once. */}
        <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
          <p
            className="animate-fade-in-up inline-flex w-fit items-center rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-gold-400 backdrop-blur-sm sm:text-xs"
            style={{ animationDelay: '0.05s' }}
          >
            {t('home.eyebrow')}
          </p>
          <h1
            className="animate-fade-in-up mt-4 font-display text-4xl font-extrabold leading-[1.02] tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '0.15s' }}
          >
            {t.rich('home.headline', {
              highlight: (chunks) => <span className="text-gold-400">{chunks}</span>,
              br: () => <br />,
            })}
          </h1>
          <p
            className="animate-fade-in-up mt-3 max-w-xl text-brand-100 sm:text-lg sm:leading-7"
            style={{ animationDelay: '0.25s' }}
          >
            {t('home.subheadline')}
          </p>

          {/* A real search bar, back after the "hero decluttering" pass
              above dropped it in favor of a text link — see this pass's
              doc comment for why. Plain GET form: submits to /search?q=...
              with no client JS needed, exactly like Help Center's search
              (app/[locale]/help/page.tsx). */}
          <form
            action="/search"
            method="GET"
            className="animate-fade-in-up mt-6 flex w-full max-w-xl overflow-hidden rounded-full border border-white/20 bg-white/95 shadow-xl backdrop-blur-sm transition-shadow focus-within:ring-2 focus-within:ring-gold-400"
            style={{ animationDelay: '0.35s' }}
          >
            <input
              type="search"
              name="q"
              placeholder={t('search.searchPlaceholder')}
              className="w-full bg-transparent px-5 py-4 text-sm text-slate-900 outline-none placeholder:text-slate-500 sm:text-base"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
              aria-label={t('search.searchAriaLabel')}
            >
              <MagnifyingGlassIcon aria-hidden className="h-5 w-5" />
              <span className="hidden sm:inline">{t('search.searchAriaLabel')}</span>
            </button>
          </form>

          {/* Co-primary discovery tools — kept exactly as the review
              readout pass elevated them, just re-centered under the new
              search bar instead of sitting alone under the headline. */}
          <div
            className="animate-fade-in-up mt-4 grid w-full max-w-xl grid-cols-2 gap-3"
            style={{ animationDelay: '0.45s' }}
          >
            <Link
              href="/near-me"
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-accent-300/50 bg-accent-600 px-4 py-3 text-sm font-semibold shadow-lg transition-colors hover:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              <ViewfinderCircleIcon aria-hidden className="h-5 w-5 text-white" />
              {t('nav.nearMe')}
            </Link>
            <Link
              href="/explore"
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur-sm transition-colors hover:border-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <MapIcon aria-hidden className="h-5 w-5" />
              {t('home.exploreMap')}
            </Link>
          </div>

          {/* Quick credibility signal — real counts from this same
              request, not marketing copy, so it never claims more than the
              catalog actually has. The counties count (a rollout-stage
              number) is now a live "join N travelers" count instead — see
              this pass's doc comment for why. */}
          <div
            className="animate-fade-in-up mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-medium text-brand-200/80 sm:text-sm"
            style={{ animationDelay: '0.55s' }}
          >
            <span>{t('home.statsUsers', { count: platformStats.totalUsers })}</span>
            <span aria-hidden>·</span>
            <span>{t('home.statsCategories', { count: categories.length })}</span>
            <span aria-hidden>·</span>
            <span>{t('home.statsPlaces', { count: trending.meta.total })}</span>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        {quickCounties.length > 0 && (
          <section aria-labelledby="counties-heading" className="hidden flex-col gap-3 lg:flex">
            <div className="flex items-center justify-between gap-3">
              <h2 id="counties-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">{t('home.browseCounties')}</h2>
              <Link href="/counties" className="hidden items-center gap-1 text-sm font-semibold text-brand-700 hover:underline sm:flex dark:text-brand-300">
                {t('common.viewAll')} <ArrowRightIcon aria-hidden className="h-4 w-4" />
              </Link>
            </div>
            <CountyGrid counties={quickCounties} />
          </section>
        )}

        <section aria-labelledby="categories-heading" className="flex flex-col gap-3">
          <h2 id="categories-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
            {t('home.browseCategories')}
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
                {t('home.featuredPlaces')}
              </h2>
              {featuredPlacements.length > 1 && (
                <Link
                  href="/featured"
                  className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
                >
                  {t('common.viewAll')}
                  <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            <FeaturedPlacementsCarousel
              placements={featuredPlacements.map((placement) => ({
                id: placement.id,
                place: placement.place,
                verificationStatus: businessVerificationByPlaceId.get(placement.place.id),
              }))}
            />
          </section>
        )}

        <PersonalizedPicksSection businessVerificationByPlaceId={businessVerificationByPlaceId} />

        <section aria-labelledby="trending-heading" className="flex flex-col gap-3 border-t border-slate-100 pt-8 dark:border-slate-800/70">
          <div className="flex items-center justify-between">
            <h2 id="trending-heading" className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
              {t('home.trendingPlaces')}
            </h2>
            <Link
              href="/search"
              className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              {t('common.seeAll')}
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
                {t('home.tripsYouCanJoin')}
              </h2>
              <Link
                href="/trips/community"
                className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
              >
                {t('common.seeAll')}
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
              {t('home.discoverThisWeek')}
            </h2>
            <Link
              href="/search"
              className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              {t('common.seeAll')}
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
              <span className="block font-display text-base font-bold">{t('home.addPlace')}</span>
              <span className="mt-0.5 block text-sm text-slate-500 dark:text-slate-400">{t('home.addPlaceDescription')}</span>
            </span>
            <ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0 text-brand-700 transition-transform group-hover:translate-x-1" />
          </Link>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/trips/new"
            className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-card"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t('home.planATrip')}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('home.planATripDescription')}</p>
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
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t('home.meetCreators')}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('home.meetCreatorsDescription')}</p>
            </div>
            <VideoCameraIcon
              aria-hidden
              className="h-6 w-6 shrink-0 text-accent-600 transition-transform duration-300 group-hover:scale-110 dark:text-accent-400"
            />
          </Link>

          <Link
            href="/car-rentals"
            className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-card"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t('home.rentCar')}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('home.rentCarDescription')}</p>
            </div>
            <TruckIcon
              aria-hidden
              className="h-6 w-6 shrink-0 text-accent-600 transition-transform duration-300 group-hover:scale-110 dark:text-accent-400"
            />
          </Link>

          <Link
            href="/pharmacies"
            className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 transition-all hover:-translate-y-0.5 hover:border-accent-400 hover:shadow-card"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{t('home.shopPharmacies')}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{t('home.shopPharmaciesDescription')}</p>
            </div>
            <BeakerIcon
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
