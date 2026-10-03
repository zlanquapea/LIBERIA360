import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRightIcon, BeakerIcon, GlobeAltIcon, TruckIcon } from '@heroicons/react/24/outline';
import { MapPinIcon } from '@heroicons/react/20/solid';
import {
  getActiveAdvertisements,
  getActiveSponsoredPlacements,
  getBusinesses,
  getCategories,
  getCounties,
  getCreators,
  getFeaturedItineraries,
  getPlaces,
  getPublicTrips,
  getUpcomingEvents,
} from '@/lib/api';
import { summarizeCollections, weekendWindow, withoutShown } from '@/lib/home-discovery';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { gradientForCategory } from '@/lib/category-colors';
import { PlaceCardCompact } from '@/components/PlaceCardCompact';
import { AdvertisementBanner } from '@/components/AdvertisementBanner';
import { FeaturedPlacementsCarousel } from '@/components/FeaturedPlacementsCarousel';
import { PersonalizedPicksSection } from '@/components/PersonalizedPicksSection';
import { PublicTripCard } from '@/components/PublicTripCard';
import { SafeImage } from '@/components/SafeImage';
import { HomeHero } from '@/components/home/HomeHero';
import { CollectionsSection } from '@/components/home/CollectionsSection';
import { WeekendSection } from '@/components/home/WeekendSection';
import { CreatorsSection } from '@/components/home/CreatorsSection';
import { CountyExplorer } from '@/components/home/CountyExplorer';
import { ContributeSection } from '@/components/home/ContributeSection';
import { SectionHeading } from '@/components/home/SectionHeading';

const POPULAR_LIMIT = 8;
const WEEKEND_LIMIT = 8;
const CREATORS_LIMIT = 6;
const TRIPS_LIMIT = 6;
const COVER_POOL_LIMIT = 48;

// Homepage, in the order a visitor decides: the promise and three ways in
// (near me, this weekend, plan a trip), moods to browse, what's on, then
// people and places. Every count is live, no listing appears twice, and
// each section has something useful to say when it's empty.
export default async function Home() {
  const t = await getTranslations();
  const weekend = weekendWindow();

  // Kept to a dozen API reads: collection counts come from the category
  // list, and covers from one featured page rather than a call per category.
  const [
    counties,
    categories,
    popular,
    featured,
    weekendEvents,
    sponsoredPlacements,
    ads,
    businesses,
    creators,
    tripIdeas,
    communityTrips,
  ] = await Promise.all([
    getCounties(),
    getCategories(),
    getPlaces({ sort: 'popular', limit: POPULAR_LIMIT + 8 }),
    getPlaces({ sort: 'featured', limit: COVER_POOL_LIMIT }),
    getUpcomingEvents({
      dateFrom: weekend.from.toISOString(),
      dateTo: weekend.to.toISOString(),
      limit: WEEKEND_LIMIT,
    }),
    getActiveSponsoredPlacements(),
    getActiveAdvertisements(),
    getBusinesses({ limit: 100 }),
    getCreators({ limit: CREATORS_LIMIT }),
    getFeaturedItineraries(),
    getPublicTrips({ limit: TRIPS_LIMIT }),
  ]);
  // Only needed when nothing is on this weekend.
  const upcomingEvents = weekendEvents.data.length === 0 ? (await getUpcomingEvents({ limit: 4 })).data : [];

  const summaries = summarizeCollections(categories, [...featured.data, ...popular.data]);

  // Random rotation so every active sponsor gets a turn at the first card.
  const start = sponsoredPlacements.length > 0 ? Math.floor(Math.random() * sponsoredPlacements.length) : 0;
  const sponsored = [...sponsoredPlacements.slice(start), ...sponsoredPlacements.slice(0, start)];
  const verificationByPlaceId = new Map(
    businesses.data.map((business) => [business.linkedPlaceId, business.verificationStatus]),
  );

  // Places already shown higher up (collection covers, sponsored cards)
  // are left out of "Popular this week".
  const alreadyShown = [
    ...summaries.flatMap((s) => (s.coverPlaceId ? [s.coverPlaceId] : [])),
    ...sponsored.map((placement) => placement.place.id),
  ];
  const popularFresh = withoutShown(popular.data, alreadyShown, POPULAR_LIMIT);

  const stats = {
    places: popular.meta.total,
    countiesCovered: counties.filter((county) => (county.placeCount ?? 0) > 0).length,
    creators: creators.meta.total,
  };

  const trips = tripIdeas.slice(0, TRIPS_LIMIT);

  return (
    <main className="flex flex-col">
      <HomeHero weekendCount={weekendEvents.data.length} stats={stats} />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 py-10 sm:gap-16 sm:px-6 sm:py-14 lg:px-10">
        <CollectionsSection summaries={summaries} />

        <WeekendSection
          events={weekendEvents.data}
          upcoming={upcomingEvents}
          from={weekend.from}
          to={weekend.to}
          isNow={weekend.isNow}
        />

        {sponsored.length > 0 && (
          <section aria-labelledby="sponsored-heading" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="sponsored-heading" className="flex items-center gap-2 font-display text-xl font-bold text-slate-950 dark:text-slate-50">
                {t('home.featuredPlaces')}
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {t('discover.sponsored')}
                </span>
              </h2>
              {sponsored.length > 1 && (
                <Link href="/featured" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  {t('discover.seeAll')}
                  <ArrowRightIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
              )}
            </div>
            <FeaturedPlacementsCarousel
              placements={sponsored.map((placement) => ({
                id: placement.id,
                place: placement.place,
                verificationStatus: verificationByPlaceId.get(placement.place.id),
              }))}
            />
          </section>
        )}

        <PersonalizedPicksSection businessVerificationByPlaceId={verificationByPlaceId} />

        {popularFresh.length > 0 && (
          <section aria-labelledby="popular-heading" className="flex flex-col gap-5">
            <SectionHeading
              id="popular-heading"
              eyebrow={t('discover.popularEyebrow')}
              title={t('discover.popularTitle')}
              href="/explore"
              linkLabel={t('discover.seeAll')}
            />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {popularFresh.map((place, i) => (
                <PlaceCardCompact key={place.id} place={place} verificationStatus={verificationByPlaceId.get(place.id)} index={i} />
              ))}
            </div>
          </section>
        )}

        <CreatorsSection creators={creators.data} />

        {(trips.length > 0 || communityTrips.data.length > 0) && (
          <section aria-labelledby="trips-heading" className="flex flex-col gap-5">
            <SectionHeading
              id="trips-heading"
              eyebrow={t('discover.tripIdeasEyebrow')}
              title={trips.length > 0 ? t('discover.tripIdeasTitle') : t('discover.communityTrips')}
              body={trips.length > 0 ? t('discover.tripIdeasBody') : undefined}
              href={trips.length > 0 ? '/trip-ideas' : '/trips/community'}
              linkLabel={t('discover.seeAll')}
            />
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              {trips.length > 0
                ? trips.map((trip) => (
                    <Link
                      key={trip.id}
                      href="/trip-ideas"
                      className="group flex w-64 shrink-0 snap-start flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:w-72 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="h-32 overflow-hidden">
                        <SafeImage
                          src={trip.coverImage ? resolveImageUrl(trip.coverImage) : null}
                          thumbSrc={trip.coverImage ? resolveThumbUrl(trip.coverImage) : null}
                          alt=""
                          className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                          fallback={
                            <div
                              aria-hidden
                              className="flex h-32 items-center justify-center"
                              style={{ backgroundImage: gradientForCategory(trip.destination?.category.slug ?? 'default') }}
                            >
                              <MapPinIcon className="h-8 w-8 text-white/90" />
                            </div>
                          }
                        />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 p-4">
                        <h3 className="font-display font-bold leading-snug text-slate-900 group-hover:text-brand-700 dark:text-slate-50 dark:group-hover:text-brand-300">
                          {trip.title}
                        </h3>
                        {trip.destination && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{trip.destination.name}</p>
                        )}
                      </div>
                    </Link>
                  ))
                : communityTrips.data.map((trip) => (
                    <div key={trip.id} className="w-64 shrink-0 snap-start sm:w-72">
                      <PublicTripCard trip={trip} />
                    </div>
                  ))}
            </div>
          </section>
        )}

        <CountyExplorer counties={counties} />

        <AdvertisementBanner ads={ads} />

        <ContributeSection />

        <nav aria-label={t('discover.essentialsLabel')} className="grid gap-3 sm:grid-cols-3">
          {[
            { href: '/car-rentals', icon: TruckIcon, title: t('home.rentCar'), hint: t('home.rentCarDescription') },
            { href: '/pharmacies', icon: BeakerIcon, title: t('home.shopPharmacies'), hint: t('home.shopPharmaciesDescription') },
            { href: '/travel-info', icon: GlobeAltIcon, title: t('nav.travelInfo'), hint: t('discover.travelInfoHint') },
          ].map(({ href, icon: Icon, title, hint }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-16 min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900"
            >
              <Icon aria-hidden className="h-6 w-6 shrink-0 text-brand-700 dark:text-brand-300" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{hint}</span>
              </span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
