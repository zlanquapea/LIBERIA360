import Link from "next/link";
import { DishNotes } from "@/components/DishNotes";
import { notFound } from "next/navigation";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { getTranslations } from "next-intl/server";
import {
  ApiError,
  getBusinessByPlace,
  getCountyPlaces,
  getCreatorGuides,
  getMenuItems,
  getMenuSettings,
  getPlaceBySlug,
  getPublicTrips,
  getReviews,
} from "@/lib/api";
import { getPharmacyByPlace } from "@/lib/pharmacy-api";
import { colorForCategory } from "@/lib/category-colors";
import { formatCost } from "@/lib/format";
import { absoluteImageUrl, galleryImages } from "@/lib/images";
import { DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/site";
import { PlaceCardCompact } from "@/components/PlaceCardCompact";
import { PlaceGallery } from "@/components/PlaceGallery";
import { PlaceMiniMapLoader } from "@/components/PlaceMiniMapLoader";
import { PlaceKeyFacts } from "@/components/PlaceKeyFacts";
import { MenuPreviewSection } from "@/components/MenuPreviewSection";
import { suggestBusinessType } from "@/lib/business-categories";
import { businessHasMenu } from "@/lib/menu";
import { PharmacyPreviewSection } from "@/components/PharmacyPreviewSection";
import { AddToTripButton } from "@/components/AddToTripButton";
import { ReviewsSection } from "@/components/ReviewsSection";
import { BusinessClaimSection } from "@/components/BusinessClaimSection";
import { PlaceViewTracker } from "@/components/PlaceViewTracker";
import { PlaceFreshnessPrompt } from "@/components/PlaceFreshnessPrompt";
import { PublicTripCard } from "@/components/PublicTripCard";
import { PlaceGoodToKnow } from "@/components/place/PlaceGoodToKnow";
import { VisitorPhotos } from "@/components/place/VisitorPhotos";
import { PlaceInGuides } from "@/components/creator-guides/PlaceInGuides";
import { distanceKm } from "@/lib/geo";
import { directionsLink } from "@/lib/contact";
import { KIND_CAPS, NEARBY_KINDS, placeKind } from "@/lib/place-kind";
import { PlaceIdentity } from "@/components/place/PlaceIdentity";
import { PlaceAtAGlance } from "@/components/place/PlaceAtAGlance";
import { EssentialHeader } from "@/components/place/EssentialHeader";
import { EssentialDetails } from "@/components/place/EssentialDetails";
import { PlaceVisitPlan } from "@/components/place/PlaceVisitPlan";
import { LoneStar } from "@/components/LoneStar";
import { JsonLd } from "@/components/JsonLd";
import { placeJsonLd } from "@/lib/structured-data";



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
  const title = `${place.name} — LIBERIA360`;
  const url = absoluteUrl(`/places/${place.slug}`);
  const image = (place.images[0] ? absoluteImageUrl(place.images[0]) : null) ?? DEFAULT_OG_IMAGE;
  return {
    title,
    description: description || undefined,
    openGraph: {
      type: "website",
      title,
      description: description || undefined,
      url,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description || undefined,
      images: [image],
    },
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

  const [nearbyResult, reviewsResult, business, pharmacy, publicTripsResult, guidesResult] =
    await Promise.all([
      getCountyPlaces(place.county.slug, { limit: 30 }),
      getReviews(place.id, { limit: 20 }),
      getBusinessByPlace(place.id),
      // A place submitted under the dedicated "Pharmacy" category is
      // auto-claimed as one (see PharmaciesService.autoClaimSubmittedPlace)
      // — null for every other place, and for a pharmacy still awaiting
      // admin approval (findByPlace's own APPROVED-only gate).
      getPharmacyByPlace(place.id),
      // Section 17's "surface public trips on destination pages" — trips
      // whose destination is this exact place, discoverable by anyone
      // browsing it, not just the trip's own creator/roster.
      getPublicTrips({ destinationPlaceId: place.id, limit: 6 }),
      getCreatorGuides({ placeId: place.id, limit: 3 }),
    ]);
  // The menu is information about *this place* to a visitor, not about the
  // separate "Business" management entity — it belongs here, not gated
  // behind a trip to the business page. Only restaurants and bars have one; see
  // MenuItemsManager's matching gate on the owner side.
  const [menuItems, menuSettings] =
    business && businessHasMenu(business.type)
      ? await Promise.all([getMenuItems(business.id), getMenuSettings(business.id)])
      : [[], null];
  // Closest first, so "nearby" means nearby.
  const nearby = nearbyResult.data
    .filter((candidate) => candidate.id !== place.id)
    .sort(
      (a, b) =>
        distanceKm({ lat: place.latitude, lng: place.longitude }, { lat: a.latitude, lng: a.longitude }) -
        distanceKm({ lat: place.latitude, lng: place.longitude }, { lat: b.latitude, lng: b.longitude }),
    );
  const kind = placeKind(place, business, Boolean(pharmacy));
  const caps = KIND_CAPS[kind];
  const essential = kind === "health" || kind === "service";
  const verification = business?.verificationStatus ?? place.verificationStatus;
  const hoursText = business?.openingHours ?? place.openingHours;
  const nearbyGroups = NEARBY_KINDS[kind]
    .map((k) => ({ kind: k, places: nearby.filter((p) => placeKind(p) === k).slice(0, 10) }))
    .filter((group) => group.places.length > 0);
  const tk = await getTranslations("placeKind");

  const location = (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{t("findYourWay")}</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{t("location")}</h2>
        </div>
        <a
          href={directionsLink(place.latitude, place.longitude)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800"
        >
          {tk("directions")}
          <ArrowRightIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
        </a>
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
      {essential && place.transportNotes ? (
        <p className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{place.transportNotes}</p>
      ) : (
        !place.transportNotes && <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t("gettingThere")}</p>
      )}
    </section>
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <JsonLd data={placeJsonLd(place)} />
      <PlaceViewTracker place={place} />

      {essential ? (
        <>
          <EssentialHeader place={place} kind={kind} business={business} verificationStatus={verification} />
          <EssentialDetails place={place} business={business} />
          {pharmacy && <PharmacyPreviewSection pharmacy={pharmacy} />}
          {location}
        </>
      ) : (
        <>
          <div>
            <PlaceGallery
              images={galleryImages(place.images, business?.images)}
              categorySlug={place.category.slug}
              categoryIcon={place.category.icon}
              alt={place.name}
            />
            <PlaceIdentity place={place} kind={kind} verificationStatus={verification} hoursText={hoursText} />
          </div>
          <PlaceAtAGlance place={place} kind={kind} business={business} menuCount={menuItems.length} menuSettings={menuSettings} />
        </>
      )}

      {/* For food, the menu is why people came: straight after the facts. */}
      {business && !essential && (
        <MenuPreviewSection
          items={menuItems}
          menuHref={`/businesses/${business.slug}/menu`}
          currency={menuSettings?.currency}
          settings={menuSettings}
        />
      )}

      <PlaceKeyFacts place={place} business={business} kind={kind} />

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
        <p className="mt-4 max-w-3xl whitespace-pre-line leading-8 text-slate-700 dark:text-slate-200">
          {place.description}
        </p>
        {!essential && <DishNotes texts={[place.name, place.description]} className="mt-5" />}
      </section>

      {kind === "destination" && place.activities && place.activities.length > 0 && (
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
              <li key={activity.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950 dark:text-slate-50">{activity.name}</p>
                  <p className="whitespace-nowrap text-sm font-semibold text-brand-700 dark:text-brand-300">
                    {formatCost(activity.price)}
                  </p>
                </div>
                {activity.description && (
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{activity.description}</p>
                )}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {[activity.duration, activity.difficulty, activity.guideRequired ? t("guideRequired") : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {caps.visitCosts && <PlaceVisitPlan place={place} />}

      {!essential && <PlaceGoodToKnow place={place} showTransport={!caps.visitCosts} />}

      {!essential && location}

      {essential && place.images.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">{tk("photos")}</h2>
          <PlaceGallery
            images={galleryImages(place.images, business?.images)}
            categorySlug={place.category.slug}
            categoryIcon={place.category.icon}
            alt={place.name}
          />
        </section>
      )}

      {caps.stories && <PlaceInGuides guides={guidesResult.data} />}

      {!essential && <VisitorPhotos reviews={reviewsResult.data} />}

      <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            {essential ? tk("experiencesEyebrow") : t("visitorNotes")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{t("reviews")}</h2>
        </div>
        <ReviewsSection placeId={place.id} initialReviews={reviewsResult.data} />
      </section>

      {caps.stories && publicTripsResult.data.length > 0 && (
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

      {nearbyGroups.length > 0 && (
        <section className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              {t("keepExploring")}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
              {t("nearbyInCounty", { county: place.county.name })}
            </h2>
          </div>
          {nearbyGroups.map((group) => (
            <div key={group.kind} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">{tk(`nearby_${group.kind}`)}</h3>
              <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                {group.places.map((nearbyPlace) => (
                  <div key={nearbyPlace.id} className="w-44 shrink-0 snap-start sm:w-48">
                    <PlaceCardCompact place={nearbyPlace} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {caps.trips && (kind === "destination" || kind === "shop") && (
        <section className="relative overflow-hidden rounded-[2rem] bg-brand-950 p-6 text-white sm:p-8">
          <LoneStar className="pointer-events-none absolute -end-8 -top-10 h-48 w-48 text-white/[0.06]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sunset-300">{tk("tripEyebrow")}</p>
              <h2 className="mt-1 font-display text-2xl font-black sm:text-3xl">{tk("tripTitle", { name: place.name })}</h2>
              <p className="mt-1 max-w-xl text-sm text-white/75">{tk("tripBody")}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link
                href="/trips/new"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-brand-900 hover:bg-sunset-100"
              >
                {t("planTripWithPlace")}
              </Link>
            </div>
          </div>
        </section>
      )}

      <section id="claim" className="scroll-mt-4">
        <BusinessClaimSection
          placeId={place.id}
          suggestedType={suggestBusinessType(place)}
          initialBusiness={business}
        />
      </section>

      <PlaceFreshnessPrompt placeId={place.id} />
    </main>
  );
}
