import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, getBusinessByPlace, getCountyPlaces, getPlaceBySlug, getReviews } from '@/lib/api';
import { colorForCategory } from '@/lib/category-colors';
import { estimateTravelTime, formatCost, formatDistance, formatPlaceType, formatRating, formatVisitLength } from '@/lib/format';
import { galleryImages } from '@/lib/images';
import { VerificationBadge } from '@/components/VerificationBadge';
import { PlaceGallery } from '@/components/PlaceGallery';
import { PlaceMiniMapLoader } from '@/components/PlaceMiniMapLoader';
import { PlaceKeyFacts } from '@/components/PlaceKeyFacts';
import { ShareMenu } from '@/components/ShareMenu';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BusinessClaimSection } from '@/components/BusinessClaimSection';
import { PlaceViewTracker } from '@/components/PlaceViewTracker';
import { PlaceFreshnessPrompt } from '@/components/PlaceFreshnessPrompt';
import { JsonLd } from '@/components/JsonLd';
import { placeJsonLd } from '@/lib/structured-data';
import type { BusinessType, Place, PlaceType } from '@/lib/types';

const NEARBY_TYPE_LABELS: Partial<Record<PlaceType, string>> = {
  hotel: 'Accommodation',
  restaurant: 'Restaurants',
  activity_provider: 'Tour guides & activities',
};

// Loose mapping from the catalog's PlaceType to the claim form's
// BusinessType — just a sensible default for the type dropdown, not a
// strict correspondence (an attraction's on-site cafe is still a
// "restaurant" business, for instance).
const SUGGESTED_BUSINESS_TYPE: Record<PlaceType, BusinessType> = {
  hotel: 'hotel',
  restaurant: 'restaurant',
  activity_provider: 'tour_operator',
  attraction: 'tour_operator',
  nature_site: 'tour_operator',
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug).catch(() => null);
  if (!place) {
    return { title: 'Place — LIBERIA360' };
  }
  const description =
    place.description.length > 160 ? `${place.description.slice(0, 157)}…` : place.description;
  return {
    title: `${place.name} — LIBERIA360`,
    description: description || undefined,
  };
}

export default async function PlaceProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const place = await getPlaceBySlug(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!place) {
    notFound();
  }

  const [nearbyResult, reviewsResult, business] = await Promise.all([
    getCountyPlaces(place.county.slug, { limit: 30 }),
    getReviews(place.id, { limit: 20 }),
    getBusinessByPlace(place.id),
  ]);
  const nearby = nearbyResult.data.filter((candidate) => candidate.id !== place.id);
  const nearbyByType = groupByType(nearby);

  const travelTime = estimateTravelTime(place.distanceFromMonroviaKm);
  const distance = formatDistance(place.distanceFromMonroviaKm);
  const visitLength = formatVisitLength(place.recommendedVisitLength);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 bg-slate-50/70 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:px-10 lg:py-10 dark:bg-slate-950/20">
      <JsonLd data={placeJsonLd(place)} />
      <PlaceViewTracker placeId={place.id} />

      <PlaceGallery
        images={galleryImages(place.images, business?.images)}
        categorySlug={place.category.slug}
        categoryIcon={place.category.icon}
        alt={place.name}
      />

      <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{formatPlaceType(place.type)}</p>
            <h1 className="flex min-w-0 flex-wrap items-center gap-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
              <span>{place.name}</span>
              <VerificationBadge status={place.verificationStatus} />
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareMenu placeName={place.name} />
          </div>
        </div>

        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {place.city}, {place.county.name} County
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-semibold text-slate-950 dark:text-slate-50">{formatRating(place.rating, place.reviewCount)}</span>
          {distance && <span className="text-slate-300 dark:text-slate-600">•</span>}
          {distance && <span>{distance}</span>}
          {travelTime && <span className="text-slate-300 dark:text-slate-600">•</span>}
          {travelTime && <span>{travelTime}</span>}
          {visitLength && <span className="text-slate-300 dark:text-slate-600">•</span>}
          {visitLength && <span>{visitLength}</span>}
        </div>

        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <PlaceKeyFacts place={place} business={business} />

      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-5">
        <PlaceFreshnessPrompt placeId={place.id} />
      </div>

      <section id="about" className="scroll-mt-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Discover the place</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">About this place</h2>
        <p className="mt-4 max-w-3xl leading-8 text-slate-700 dark:text-slate-200">{place.description}</p>
      </section>

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Find your way</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Location</h2>
        </div>
        <div className="h-56 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 sm:h-72">
          <PlaceMiniMapLoader
            latitude={place.latitude}
            longitude={place.longitude}
            color={colorForCategory(place.category.slug)}
            icon={place.category.icon}
            categorySlug={place.category.slug}
          />
        </div>
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          Getting there: private car, taxi, tour operator arrangement, or shared/bus transport where available.
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Budget planning</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Estimated cost</h2>
        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <CostItem label="Entry" value={formatCost(place.estimatedCostEntry)} />
          <CostItem label="Guide" value={formatCost(place.estimatedCostGuide)} />
          <CostItem label="Transport" value={formatCost(place.estimatedCostTransport)} />
        </dl>
      </section>

      {place.activities && place.activities.length > 0 && (
        <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Make the most of it</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Things to do</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {place.activities.map((activity) => (
              <li key={activity.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950 dark:text-slate-50">{activity.name}</p>
                  <p className="whitespace-nowrap text-sm font-semibold text-brand-700 dark:text-brand-300">{formatCost(activity.price)}</p>
                </div>
                {activity.description && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{activity.description}</p>}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {[activity.duration, activity.difficulty, activity.guideRequired ? 'Guide required' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="claim" className="scroll-mt-4">
        <BusinessClaimSection
          placeId={place.id}
          suggestedType={SUGGESTED_BUSINESS_TYPE[place.type]}
          initialBusiness={business}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Visitor notes</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Reviews</h2>
        </div>
        <ReviewsSection placeId={place.id} initialReviews={reviewsResult.data} />
      </section>

      {Object.keys(nearbyByType).length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Keep exploring</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">Nearby in {place.county.name}</h2>
          </div>
          {Object.entries(nearbyByType).map(([type, places]) => (
            <div key={type} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{NEARBY_TYPE_LABELS[type as PlaceType] ?? formatPlaceType(type as PlaceType)}</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {places.map((nearbyPlace) => (
                  <Link
                    key={nearbyPlace.id}
                    href={`/places/${nearbyPlace.slug}`}
                    className="w-52 shrink-0 rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-500 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{nearbyPlace.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{nearbyPlace.city}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
        <Link
          href={`/trips/new?interest=${place.category.slug}`}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand-700 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Plan a trip with this place
        </Link>
      </section>
    </main>
  );
}

function CostItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">{value}</dd>
    </div>
  );
}

function groupByType(places: Place[]): Partial<Record<PlaceType, Place[]>> {
  const groups: Partial<Record<PlaceType, Place[]>> = {};
  for (const place of places) {
    if (place.type === 'attraction' || place.type === 'nature_site') continue; // "nearby" here means services, not more sights
    (groups[place.type] ??= []).push(place);
  }
  return groups;
}
