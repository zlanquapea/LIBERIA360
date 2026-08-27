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
  const nearby = nearbyResult.data.filter((p) => p.id !== place.id);
  const nearbyByType = groupByType(nearby);

  const travelTime = estimateTravelTime(place.distanceFromMonroviaKm);
  const distance = formatDistance(place.distanceFromMonroviaKm);
  const visitLength = formatVisitLength(place.recommendedVisitLength);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12">
      <JsonLd data={placeJsonLd(place)} />
      <PlaceViewTracker placeId={place.id} />
      <PlaceGallery
        images={galleryImages(place.images, business?.images)}
        categorySlug={place.category.slug}
        categoryIcon={place.category.icon}
        alt={place.name}
      />

      <header className="flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-card dark:bg-slate-900 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">{place.name}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <VerificationBadge status={place.verificationStatus} />
            <ShareMenu placeName={place.name} />
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {formatPlaceType(place.type)} · {place.city}, {place.county.name} County
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span>{formatRating(place.rating, place.reviewCount)}</span>
          {distance && <span>· {distance}</span>}
          {travelTime && <span>· {travelTime}</span>}
          {visitLength && <span>· {visitLength}</span>}
        </div>
        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {place.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <PlaceKeyFacts place={place} business={business} />

      <PlaceFreshnessPrompt placeId={place.id} />

      <p className="rounded-3xl bg-brand-50/70 p-5 leading-7 text-slate-700 dark:bg-slate-900 dark:text-slate-200 sm:p-6">{place.description}</p>

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">Location</h2>
        <div className="h-48 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <PlaceMiniMapLoader
            latitude={place.latitude}
            longitude={place.longitude}
            color={colorForCategory(place.category.slug)}
            icon={place.category.icon}
            categorySlug={place.category.slug}
          />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Getting there: private car, taxi, tour operator arrangement, or shared/bus transport where available.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">Estimated cost</h2>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <CostItem label="Entry" value={formatCost(place.estimatedCostEntry)} />
          <CostItem label="Guide" value={formatCost(place.estimatedCostGuide)} />
          <CostItem label="Transport" value={formatCost(place.estimatedCostTransport)} />
        </dl>
      </section>

      {place.activities && place.activities.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Things to do</h2>
          <ul className="flex flex-col gap-2">
            {place.activities.map((activity) => (
              <li key={activity.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-slate-50">{activity.name}</p>
                  <p className="whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{formatCost(activity.price)}</p>
                </div>
                {activity.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{activity.description}</p>}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {[activity.duration, activity.difficulty, activity.guideRequired ? 'Guide required' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="claim" className="flex scroll-mt-4 flex-col gap-2">
        <BusinessClaimSection
          placeId={place.id}
          suggestedType={SUGGESTED_BUSINESS_TYPE[place.type]}
          initialBusiness={business}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">Reviews</h2>
        <ReviewsSection placeId={place.id} initialReviews={reviewsResult.data} />
      </section>

      {Object.keys(nearbyByType).length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Nearby in {place.county.name}</h2>
          {Object.entries(nearbyByType).map(([type, places]) => (
            <div key={type} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">{NEARBY_TYPE_LABELS[type as PlaceType] ?? formatPlaceType(type as PlaceType)}</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {places.map((p) => (
                  <Link
                    key={p.id}
                    href={`/places/${p.slug}`}
                    className="w-48 shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:border-brand-500"
                  >
                    <p className="font-medium text-slate-900 dark:text-slate-50">{p.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{p.city}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <Link
          href={`/trips/new?interest=${place.category.slug}`}
          className="flex min-h-12 flex-1 items-center justify-center rounded-2xl bg-brand-700 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          Plan a trip with this place
        </Link>
      </section>
    </main>
  );
}

function CostItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-center">
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-50">{value}</dd>
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
