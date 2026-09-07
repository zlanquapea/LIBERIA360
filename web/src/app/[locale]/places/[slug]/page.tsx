import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import {
  ApiError,
  getBusinessByPlace,
  getCountyPlaces,
  getMenuItems,
  getPlaceBySlug,
  getPublicTrips,
  getReviews,
} from "@/lib/api";
import { colorForCategory } from "@/lib/category-colors";
import {
  estimateTravelTime,
  formatCost,
  formatDistance,
  formatPlaceType,
  formatRating,
  formatVisitLength,
} from "@/lib/format";
import { galleryImages } from "@/lib/images";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PlaceCardCompact } from "@/components/PlaceCardCompact";
import { PlaceGallery } from "@/components/PlaceGallery";
import { PlaceMiniMapLoader } from "@/components/PlaceMiniMapLoader";
import { PlaceKeyFacts } from "@/components/PlaceKeyFacts";
import { MenuPreviewSection } from "@/components/MenuPreviewSection";
import { ShareMenu } from "@/components/ShareMenu";
import { ReviewsSection } from "@/components/ReviewsSection";
import { BusinessClaimSection } from "@/components/BusinessClaimSection";
import { PlaceViewTracker } from "@/components/PlaceViewTracker";
import { PlaceFreshnessPrompt } from "@/components/PlaceFreshnessPrompt";
import { PublicTripCard } from "@/components/PublicTripCard";
import { JsonLd } from "@/components/JsonLd";
import { placeJsonLd } from "@/lib/structured-data";
import type { BusinessType, Place, PlaceType } from "@/lib/types";

// Keys into placeDetail.nearby* — see NEARBY_TYPE_LABELS's usage below.
// lib/format.ts's own formatPlaceType() (used as this map's fallback) is
// not yet translated — a broader, cross-cutting change deferred past this
// phase since it's called from many components beyond this page.
const NEARBY_TYPE_LABEL_KEYS: Partial<Record<PlaceType, string>> = {
  hotel: "nearbyAccommodation",
  restaurant: "nearbyRestaurants",
  activity_provider: "nearbyTourGuides",
};

// Loose mapping from the catalog's PlaceType to the claim form's
// BusinessType — just a sensible default for the type dropdown, not a
// strict correspondence (an attraction's on-site cafe is still a
// "restaurant" business, for instance).
const SUGGESTED_BUSINESS_TYPE: Record<PlaceType, BusinessType> = {
  hotel: "hotel",
  restaurant: "restaurant",
  activity_provider: "tour_operator",
  attraction: "tour_operator",
  nature_site: "tour_operator",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug).catch(() => null);
  if (!place) {
    return { title: "Place — LIBERIA360" };
  }
  const description =
    place.description.length > 160
      ? `${place.description.slice(0, 157)}…`
      : place.description;
  return {
    title: `${place.name} — LIBERIA360`,
    description: description || undefined,
  };
}

export default async function PlaceProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getTranslations("placeDetail");
  const { slug } = await params;

  const place = await getPlaceBySlug(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!place) {
    notFound();
  }

  const [nearbyResult, reviewsResult, business, publicTripsResult] = await Promise.all([
    getCountyPlaces(place.county.slug, { limit: 30 }),
    getReviews(place.id, { limit: 20 }),
    getBusinessByPlace(place.id),
    // Section 17's "surface public trips on destination pages" — trips
    // whose destination is this exact place, discoverable by anyone
    // browsing it, not just the trip's own creator/roster.
    getPublicTrips({ destinationPlaceId: place.id, limit: 6 }),
  ]);
  // The menu is information about *this place* to a visitor, not about the
  // separate "Business" management entity — it belongs here, not gated
  // behind a trip to the business page. Only restaurants have one; see
  // MenuItemsManager's matching gate on the owner side.
  const menuItems =
    business?.type === "restaurant" ? await getMenuItems(business.id) : [];
  const nearby = nearbyResult.data.filter(
    (candidate) => candidate.id !== place.id,
  );
  const nearbyByType = groupByType(nearby);

  const travelTime = estimateTravelTime(place.distanceFromMonroviaKm);
  const distance = formatDistance(place.distanceFromMonroviaKm);
  const visitLength = formatVisitLength(place.recommendedVisitLength);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 bg-slate-50/70 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:px-10 lg:py-10 dark:bg-slate-950/20">
      <JsonLd data={placeJsonLd(place)} />
      <PlaceViewTracker place={place} />

      <PlaceGallery
        images={galleryImages(place.images, business?.images)}
        categorySlug={place.category.slug}
        categoryIcon={place.category.icon}
        alt={place.name}
      />

      <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              {formatPlaceType(place.type)}
            </p>
            <h1 className="flex min-w-0 flex-wrap items-center gap-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
              <span>{place.name}</span>
              <VerificationBadge
                status={
                  business?.verificationStatus ?? place.verificationStatus
                }
              />
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareMenu placeName={place.name} />
          </div>
        </div>

        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t("cityCounty", { city: place.city, county: place.county.name })}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-semibold text-slate-950 dark:text-slate-50">
            {formatRating(place.rating, place.reviewCount)}
          </span>
          {distance && (
            <span className="text-slate-300 dark:text-slate-600">•</span>
          )}
          {distance && <span>{distance}</span>}
          {travelTime && (
            <span className="text-slate-300 dark:text-slate-600">•</span>
          )}
          {travelTime && <span>{travelTime}</span>}
          {visitLength && (
            <span className="text-slate-300 dark:text-slate-600">•</span>
          )}
          {visitLength && <span>{visitLength}</span>}
        </div>

        {place.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
              >
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

      <section
        id="about"
        className="scroll-mt-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7"
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          {t("discoverThePlace")}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
          {t("aboutThisPlace")}
        </h2>
        <p className="mt-4 max-w-3xl leading-8 text-slate-700 dark:text-slate-200">
          {place.description}
        </p>
      </section>

      {business && <MenuPreviewSection items={menuItems} menuHref={`/businesses/${business.slug}/menu`} />}

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            {t("findYourWay")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
            {t("location")}
          </h2>
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
          {t("gettingThere")}
        </p>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
          {t("budgetPlanning")}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
          {t("estimatedCost")}
        </h2>
        <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <CostItem
            label={t("costEntry")}
            value={formatCost(place.estimatedCostEntry)}
          />
          <CostItem
            label={t("costGuide")}
            value={formatCost(place.estimatedCostGuide)}
          />
          <CostItem
            label={t("costTransport")}
            value={formatCost(place.estimatedCostTransport)}
          />
        </dl>
      </section>

      {place.activities && place.activities.length > 0 && (
        <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              {t("makeTheMostOfIt")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
              {t("thingsToDo")}
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {place.activities.map((activity) => (
              <li
                key={activity.id}
                className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950 dark:text-slate-50">
                    {activity.name}
                  </p>
                  <p className="whitespace-nowrap text-sm font-semibold text-brand-700 dark:text-brand-300">
                    {formatCost(activity.price)}
                  </p>
                </div>
                {activity.description && (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {activity.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {[
                    activity.duration,
                    activity.difficulty,
                    activity.guideRequired ? t("guideRequired") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            {t("visitorNotes")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
            {t("reviews")}
          </h2>
        </div>
        <ReviewsSection
          placeId={place.id}
          initialReviews={reviewsResult.data}
        />
      </section>

      {publicTripsResult.data.length > 0 && (
        <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                {t("travelTogether")}
              </p>
              <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
                {t("tripsHeadingHere")}
              </h2>
            </div>
            <Link
              href="/trips/community"
              className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t("seeAllCommunityTrips")}
              <ArrowRightIcon aria-hidden className="h-3.5 w-3.5 rtl:-scale-x-100" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicTripsResult.data.map((trip) => (
              <PublicTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      )}

      {Object.keys(nearbyByType).length > 0 && (
        <section className="flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              {t("keepExploring")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
              {t("nearbyInCounty", { county: place.county.name })}
            </h2>
          </div>
          {Object.entries(nearbyByType).map(([type, places]) => (
            <div key={type} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {(() => {
                  const labelKey = NEARBY_TYPE_LABEL_KEYS[type as PlaceType];
                  return labelKey ? t(labelKey) : formatPlaceType(type as PlaceType);
                })()}
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {places.map((nearbyPlace) => (
                  <div key={nearbyPlace.id} className="w-44 shrink-0 sm:w-48">
                    <PlaceCardCompact place={nearbyPlace} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
        <Link
          href="/trips/new"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand-700 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          {t("planTripWithPlace")}
        </Link>
      </section>
    </main>
  );
}

function CostItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950/40">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
        {value}
      </dd>
    </div>
  );
}

function groupByType(places: Place[]): Partial<Record<PlaceType, Place[]>> {
  const groups: Partial<Record<PlaceType, Place[]>> = {};
  for (const place of places) {
    if (place.type === "attraction" || place.type === "nature_site") continue; // "nearby" here means services, not more sights
    (groups[place.type] ??= []).push(place);
  }
  return groups;
}
