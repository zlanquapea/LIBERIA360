import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ApiError, getBusinessByPlace, getCountyPlaces, getPlaceBySlug, getReviews } from '@/lib/api';
import { colorForCategory } from '@/lib/category-colors';
import { directionsLink, whatsappLink } from '@/lib/contact';
import { estimateTravelTime, formatCost, formatDistance, formatPlaceType, formatRating, formatVisitLength } from '@/lib/format';
import { galleryImages } from '@/lib/images';
import { VerificationBadge } from '@/components/VerificationBadge';
import { PlaceGallery } from '@/components/PlaceGallery';
import { PlaceMiniMapLoader } from '@/components/PlaceMiniMapLoader';
import { SaveButton } from '@/components/SaveButton';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BusinessClaimSection } from '@/components/BusinessClaimSection';
import { BookingRequestSection } from '@/components/BookingRequestSection';
import { PlaceViewTracker } from '@/components/PlaceViewTracker';
import { ContactLink } from '@/components/ContactLink';
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
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
      <JsonLd data={placeJsonLd(place)} />
      <PlaceViewTracker placeId={place.id} />
      <PlaceGallery
        images={galleryImages(place.images, business?.images)}
        categorySlug={place.category.slug}
        categoryIcon={place.category.icon}
        alt={place.name}
      />

      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{place.name}</h1>
          <VerificationBadge status={place.verificationStatus} />
        </div>
        <p className="text-sm text-slate-500">
          {formatPlaceType(place.type)} · {place.city}, {place.county.name} County
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span>{formatRating(place.rating, place.reviewCount)}</span>
          {distance && <span>· {distance}</span>}
          {travelTime && <span>· {travelTime}</span>}
          {visitLength && <span>· {visitLength}</span>}
        </div>
        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {place.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <PlaceFreshnessPrompt placeId={place.id} />

      <p className="text-slate-700">{place.description}</p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Location</h2>
        <div className="h-48 overflow-hidden rounded-xl border border-slate-200">
          <PlaceMiniMapLoader
            latitude={place.latitude}
            longitude={place.longitude}
            color={colorForCategory(place.category.slug)}
            icon={place.category.icon}
          />
        </div>
        <a
          href={directionsLink(place.latitude, place.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          🧭 Get Directions
        </a>
        <p className="text-xs text-slate-500">
          Getting there: private car, taxi, tour operator arrangement, or shared/bus transport where available.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Estimated cost</h2>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <CostItem label="Entry" value={formatCost(place.estimatedCostEntry)} />
          <CostItem label="Guide" value={formatCost(place.estimatedCostGuide)} />
          <CostItem label="Transport" value={formatCost(place.estimatedCostTransport)} />
        </dl>
      </section>

      {place.activities && place.activities.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-slate-900">Things to do</h2>
          <ul className="flex flex-col gap-2">
            {place.activities.map((activity) => (
              <li key={activity.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-slate-900">{activity.name}</p>
                  <p className="whitespace-nowrap text-sm text-slate-600">{formatCost(activity.price)}</p>
                </div>
                {activity.description && <p className="mt-1 text-sm text-slate-600">{activity.description}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {[activity.duration, activity.difficulty, activity.guideRequired ? 'Guide required' : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Contact</h2>
        {place.contactPhone || place.whatsapp ? (
          <div className="flex flex-wrap gap-2">
            {place.contactPhone && (
              <ContactLink
                placeId={place.id}
                href={`tel:${place.contactPhone}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-brand-500"
              >
                📞 Call
              </ContactLink>
            )}
            {place.whatsapp && (
              <ContactLink
                placeId={place.id}
                href={whatsappLink(place.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                💬 WhatsApp
              </ContactLink>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No verified contact on file yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Business listing</h2>
        <BusinessClaimSection
          placeId={place.id}
          suggestedType={SUGGESTED_BUSINESS_TYPE[place.type]}
          initialBusiness={business}
        />
        {business && <BookingRequestSection business={business} />}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Reviews</h2>
        <ReviewsSection placeId={place.id} initialReviews={reviewsResult.data} />
      </section>

      {Object.keys(nearbyByType).length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold text-slate-900">Nearby in {place.county.name}</h2>
          {Object.entries(nearbyByType).map(([type, places]) => (
            <div key={type} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-slate-600">{NEARBY_TYPE_LABELS[type as PlaceType] ?? formatPlaceType(type as PlaceType)}</h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {places.map((p) => (
                  <Link
                    key={p.id}
                    href={`/places/${p.slug}`}
                    className="w-48 shrink-0 rounded-xl border border-slate-200 p-3 hover:border-brand-500"
                  >
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.city}</p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="flex gap-3 border-t border-slate-200 pt-4">
        <SaveButton slug={place.slug} placeId={place.id} className="flex-1 justify-center" />
        <button
          type="button"
          disabled
          className="flex-1 rounded-full border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-400"
          title="Trip planning arrives in Phase 2"
        >
          Plan Trip (Phase 2)
        </button>
      </section>
    </main>
  );
}

function CostItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 text-center">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
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
