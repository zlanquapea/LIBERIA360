import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  MapPinIcon,
  PhoneIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import {
  BanknotesIcon,
  BoltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  CogIcon,
  FireIcon,
  IdentificationIcon,
  MapIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TruckIcon as SolidTruckIcon,
  UserGroupIcon,
  UserPlusIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import {
  ApiError,
  getCarListingById,
  getCarListingReviews,
  getCarListings,
} from "@/lib/api";
import { recommendCars } from "@/lib/car-recommendations";
import { gradientForCategory } from "@/lib/category-colors";
import {
  describeCarCancellationPolicy,
  formatCarCancellationPolicy,
  formatCarCategory,
  formatCarFuelPolicy,
  formatCarFuelType,
  formatCarTransmission,
  formatCost,
} from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { whatsappLink } from "@/lib/contact";
import { rentalEstimates } from "@/lib/car-estimates";
import { PlaceGallery } from "@/components/PlaceGallery";
import { ReviewsSection } from "@/components/ReviewsSection";
import { BookingRequestSection } from "@/components/BookingRequestSection";
import { AddToTripButton } from "@/components/AddToTripButton";
import { CarRecommendations } from "@/components/CarRecommendations";
import { ShareMenu } from "@/components/ShareMenu";
import { LrdHint } from "@/components/LrdHint";
import { VerificationSeal } from "@/components/VerificationBadge";
import { PlaceRating } from "@/components/place-card-parts";

type SearchParams = { [key: string]: string | string[] | undefined };

function rentalQuery(params: SearchParams) {
  const query = new URLSearchParams();
  for (const key of [
    "pickupDate",
    "returnDate",
    "pickupLocation",
    "countyId",
  ]) {
    const value = params[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) query.set(key, first);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getCarListingById(id).catch(() => null);
  if (!listing) {
    return { title: "Car Rental — LIBERIA360" };
  }
  return { title: `${listing.title} — LIBERIA360` };
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-24 flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7"
    >
      <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50 sm:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One rental rule, with an icon and an optional plain-language line. */
function Term({
  icon: Icon,
  label,
  value,
  note,
  tone = "neutral",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note?: string | null;
  tone?: "good" | "neutral";
}) {
  return (
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700">
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          tone === "good"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
            : "bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          {label}
        </dt>
        <dd className="mt-0.5 font-semibold text-slate-900 dark:text-slate-50">
          {value}
        </dd>
        {note && (
          <dd className="mt-0.5 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {note}
          </dd>
        )}
      </div>
    </div>
  );
}

const contactPrimary =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700";
const contactSecondary =
  "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30";

// A car as it would sit in a showroom: the vehicle under a spotlight on
// a dark stage with its dashboard of specs, and a rental counter beside
// it holding the day rate, the booking button and the fine print a
// renter checks before paying anything. Everything below the stage —
// terms, pickup, host, reviews — is what people ask before they commit.
export default async function CarListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = rentalQuery(await searchParams);

  const listing = await getCarListingById(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!listing) {
    notFound();
  }

  const t = await getTranslations("carPage");
  const [reviewsResult, catalog] = await Promise.all([
    getCarListingReviews(listing.id, { limit: 20 }),
    getCarListings({ limit: 100 }),
  ]);
  const recommendations = recommendCars(listing, catalog.data);
  const images = listing.images.map(resolveImageUrl);
  const business = listing.business;
  // Every listing has a direct county now (see CarListing's doc comment);
  // the linked business's place, if any, is more specific and wins when
  // present.
  const location = business?.linkedPlace
    ? `${business.linkedPlace.city.trim()}, ${business.linkedPlace.county.name} County`
    : listing.county
      ? `${listing.county.name} County`
      : null;
  const bookHref = `/car-rentals/${listing.id}/book${query}`;
  const estimates = rentalEstimates(listing);

  const hostName = business?.name ?? listing.owner?.name ?? t("hostFallback");
  const hostPhone = business?.phone ?? listing.contactPhone;
  const hostWhatsapp = business?.whatsapp ?? listing.contactWhatsapp;

  const specs = [
    { icon: UserGroupIcon, label: t("seats"), value: String(listing.seats) },
    {
      icon: CogIcon,
      label: t("gearbox"),
      value: formatCarTransmission(listing.transmission),
    },
    { icon: FireIcon, label: t("fuel"), value: formatCarFuelType(listing.fuelType) },
    { icon: CalendarDaysIcon, label: t("year"), value: String(listing.year) },
    ...(listing.color
      ? [{ icon: SparklesIcon, label: t("colour"), value: listing.color }]
      : []),
    {
      icon: IdentificationIcon,
      label: t("driver"),
      value: listing.withDriverAvailable ? t("driverOptional") : t("selfDrive"),
    },
  ];

  const hasTerms =
    listing.mileageLimitPerDay != null ||
    listing.fuelPolicy != null ||
    listing.minDriverAge != null ||
    listing.additionalDriverAllowed ||
    listing.cancellationPolicy != null ||
    listing.securityDeposit != null;

  return (
    <main className="pb-24 lg:pb-12">
      {/* ── The stage ─────────────────────────────────────────────── */}
      <div className="relative isolate overflow-hidden bg-slate-950 text-white">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_35%_0%,rgb(16_185_129/0.22),transparent_70%),radial-gradient(ellipse_50%_40%_at_100%_100%,rgb(250_204_21/0.08),transparent_70%)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-[linear-gradient(to_top,rgb(255_255_255/0.04),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 sm:pb-12 lg:px-10">
          <Link
            href="/car-rentals"
            className="mb-5 flex w-fit items-center gap-1 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <ChevronLeftIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
            {t("back")}
          </Link>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
            <div className="flex min-w-0 flex-col gap-4">
              {images.length > 0 ? (
                <PlaceGallery
                  images={images}
                  categorySlug={listing.category}
                  categoryIcon={null}
                  alt={listing.title}
                />
              ) : (
                <div
                  className="relative flex h-72 items-center justify-center overflow-hidden rounded-[2rem] ring-1 ring-white/10 sm:h-[30rem]"
                  style={{ backgroundImage: gradientForCategory(listing.category) }}
                >
                  <span aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgb(255_255_255/0.25),transparent_60%)]" />
                  <TruckIcon aria-hidden className="relative h-24 w-24 text-white/70" />
                  <span className="absolute bottom-4 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur-md">
                    {t("noPhotos")}
                  </span>
                </div>
              )}

              {/* Dashboard */}
              <dl
                aria-label={t("specs")}
                className="grid grid-cols-3 gap-2 sm:grid-cols-6"
              >
                {specs.map((s) => (
                  <div
                    key={s.label}
                    className="flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-white/[0.05] px-2 py-3 text-center ring-1 ring-inset ring-white/10"
                  >
                    <s.icon aria-hidden className="h-5 w-5 text-emerald-300" />
                    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">
                      {s.label}
                    </dt>
                    <dd className="w-full truncate text-sm font-semibold">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Rental counter */}
            <aside className="flex flex-col gap-5 lg:sticky lg:top-24">
              <header className="flex flex-col gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
                  {formatCarCategory(listing.category)}
                </p>
                <h1 className="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl">
                  {listing.title}
                </h1>
                <p className="text-sm text-white/60">
                  {listing.year} {listing.make} {listing.model}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-white/70">
                  <PlaceRating place={listing} />
                  {location && (
                    <span className="flex items-center gap-1">
                      <MapPinIcon aria-hidden className="h-4 w-4" />
                      {location}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {listing.instantBookEnabled && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold-400 px-2.5 py-1 text-xs font-bold text-slate-950">
                      <BoltIcon aria-hidden className="h-3.5 w-3.5" />
                      {t("instantBook")}
                    </span>
                  )}
                  {listing.insuranceIncluded && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/20">
                      <ShieldCheckIcon aria-hidden className="h-3.5 w-3.5 text-emerald-300" />
                      {t("insured")}
                    </span>
                  )}
                  {listing.deliveryAvailable && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/20">
                      <SolidTruckIcon aria-hidden className="h-3.5 w-3.5 text-emerald-300" />
                      {t("delivers")}
                    </span>
                  )}
                </div>
              </header>

              <div className="flex flex-col gap-4 rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-2xl ring-1 ring-white/10 dark:bg-slate-900 dark:text-slate-50">
                <div className="rounded-2xl bg-slate-950 px-4 py-3 ring-1 ring-inset ring-emerald-400/20">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200/60">
                    {t("dayRate")}
                  </p>
                  <p className="lib-readout mt-1 font-mono text-3xl font-bold tabular-nums leading-none text-emerald-300">
                    {formatCost(listing.pricePerDay)}
                    <span className="ms-1 font-sans text-sm font-medium text-emerald-200/70">
                      {t("perDay")}
                    </span>
                  </p>
                  <LrdHint usd={Number(listing.pricePerDay)} className="mt-1 block text-xs !text-emerald-100/50" />
                </div>

                <ul className="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  {listing.pricePerHour != null && (
                    <li className="flex items-center gap-2">
                      <ClockIcon aria-hidden className="h-4 w-4 text-slate-400" />
                      {t("hourly", { price: formatCost(listing.pricePerHour) })}
                      {listing.minRentalHours != null && listing.minRentalHours > 1 && (
                        <span className="text-slate-400">· {t("minHours", { count: listing.minRentalHours })}</span>
                      )}
                    </li>
                  )}
                  {listing.minRentalDays > 1 && (
                    <li className="flex items-center gap-2">
                      <CalendarDaysIcon aria-hidden className="h-4 w-4 text-slate-400" />
                      {t("minDays", { count: listing.minRentalDays })}
                    </li>
                  )}
                  {listing.withDriverAvailable && (
                    <li className="flex items-center gap-2">
                      <IdentificationIcon aria-hidden className="h-4 w-4 text-slate-400" />
                      {t("driverFee", { price: formatCost(listing.driverFeePerDay) })}
                    </li>
                  )}
                  {listing.securityDeposit != null && (
                    <li className="flex items-center gap-2">
                      <BanknotesIcon aria-hidden className="h-4 w-4 text-slate-400" />
                      {t("deposit", { price: formatCost(listing.securityDeposit) })}
                    </li>
                  )}
                </ul>

                <BookingRequestSection
                  carListing={listing}
                  prominent
                  mode="link"
                  href={bookHref}
                />
                {listing.instantBookEnabled && (
                  <p className="-mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                    {t("instantNote")}
                  </p>
                )}
                <p className="-mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
                  {t("noPaymentYet")}
                </p>

                <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="flex-1">
                    <AddToTripButton
                      contentType="carListing"
                      itemId={listing.id}
                      itemName={listing.title}
                    />
                  </div>
                  <ShareMenu placeName={listing.title} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* ── Below the stage ───────────────────────────────────────── */}
      <div className="mx-auto mt-6 grid grid-cols-1 max-w-6xl gap-6 px-4 sm:mt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-10">
        <div className="flex min-w-0 flex-col gap-6">
          {listing.description && (
            <Section title={t("about")}>
              <p className="whitespace-pre-wrap leading-8 text-slate-700 dark:text-slate-200">
                {listing.description}
              </p>
            </Section>
          )}

          {listing.features.length > 0 && (
            <Section title={t("features")}>
              <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {listing.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                    <CheckCircleIcon aria-hidden className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {feature}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {hasTerms && (
            <Section id="terms" title={t("terms")}>
              <dl className="grid gap-3 sm:grid-cols-2">
                {listing.cancellationPolicy != null && (
                  <Term
                    icon={CalendarDaysIcon}
                    label={t("cancellation")}
                    value={formatCarCancellationPolicy(listing.cancellationPolicy)}
                    note={describeCarCancellationPolicy(listing.cancellationPolicy)}
                    tone={listing.cancellationPolicy === "flexible" ? "good" : "neutral"}
                  />
                )}
                {listing.mileageLimitPerDay != null ? (
                  <Term
                    icon={MapIcon}
                    label={t("mileage")}
                    value={t("mileageLimit", { miles: listing.mileageLimitPerDay })}
                    note={
                      listing.excessMileageFee != null
                        ? t("mileageExcess", { price: formatCost(listing.excessMileageFee) })
                        : null
                    }
                  />
                ) : (
                  <Term icon={MapIcon} label={t("mileage")} value={t("mileageUnlimited")} tone="good" />
                )}
                {listing.fuelPolicy != null && (
                  <Term
                    icon={FireIcon}
                    label={t("fuelPolicy")}
                    value={formatCarFuelPolicy(listing.fuelPolicy)}
                    note={t(`fuelNote_${listing.fuelPolicy}`)}
                  />
                )}
                {listing.minDriverAge != null && (
                  <Term
                    icon={IdentificationIcon}
                    label={t("minAge")}
                    value={t("minAgeValue", { age: listing.minDriverAge })}
                    note={t("licenceNote")}
                  />
                )}
                <Term
                  icon={listing.insuranceIncluded ? ShieldCheckIcon : XCircleIcon}
                  label={t("insurance")}
                  value={listing.insuranceIncluded ? t("insuranceYes") : t("insuranceNo")}
                  note={listing.insuranceIncluded ? listing.insuranceNotes : t("insuranceAsk")}
                  tone={listing.insuranceIncluded ? "good" : "neutral"}
                />
                {listing.additionalDriverAllowed && (
                  <Term
                    icon={UserPlusIcon}
                    label={t("extraDriver")}
                    value={t("extraDriverYes")}
                    note={
                      listing.additionalDriverFee != null
                        ? t("extraDriverFee", { price: formatCost(listing.additionalDriverFee) })
                        : null
                    }
                    tone="good"
                  />
                )}
                {listing.securityDeposit != null && (
                  <Term
                    icon={BanknotesIcon}
                    label={t("depositLabel")}
                    value={formatCost(listing.securityDeposit)}
                    note={t("depositNote")}
                  />
                )}
              </dl>
            </Section>
          )}

          {(listing.pickupLocation || listing.deliveryAvailable) && (
            <Section title={t("pickup")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {listing.pickupLocation && (
                  <div className="flex gap-3">
                    <MapPinIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{t("pickupAt")}</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-50">{listing.pickupLocation}</p>
                    </div>
                  </div>
                )}
                {listing.deliveryAvailable && (
                  <div className="flex gap-3">
                    <SolidTruckIcon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{t("delivery")}</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-50">
                        {listing.deliveryFee != null ? t("deliveryFee", { price: formatCost(listing.deliveryFee) }) : t("deliveryAsk")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section id="reviews" title={t("reviews")}>
            <ReviewsSection
              carListingId={listing.id}
              initialReviews={reviewsResult.data}
            />
          </Section>
        </div>

        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          {estimates.length > 0 && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">{t("estimateTitle")}</h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {estimates.map((row) => (
                    <tr key={row.days} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <th scope="row" className="py-2 text-start font-medium text-slate-600 dark:text-slate-300">
                        {t("estimateDays", { count: row.days })}
                      </th>
                      <td className="py-2 text-end font-mono font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {formatCost(row.total)}
                        <LrdHint usd={row.total} className="block text-xs font-sans font-normal" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{t("estimateNote")}</p>
            </section>
          )}

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{t("host")}</p>
            <div className="mt-3 flex items-center gap-3">
              <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 font-display text-lg font-bold text-emerald-300">
                {hostName.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold text-slate-950 dark:text-slate-50">
                  {business ? (
                    <Link href={`/businesses/${business.slug}`} className="truncate hover:underline">
                      {hostName}
                    </Link>
                  ) : (
                    <span className="truncate">{hostName}</span>
                  )}
                  {business && <VerificationSeal status={business.verificationStatus} />}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {business ? t("hostBusiness") : t("hostIndividual")}
                </p>
              </div>
            </div>
            {(hostWhatsapp || hostPhone) ? (
              <div className="mt-4 flex gap-2">
                {hostWhatsapp && (
                  <a href={whatsappLink(hostWhatsapp)} target="_blank" rel="noopener noreferrer" className={contactPrimary}>
                    <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                {hostPhone && (
                  <a href={`tel:${hostPhone}`} className={contactSecondary}>
                    <PhoneIcon aria-hidden className="h-4 w-4" />
                    {t("call")}
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{t("hostViaBooking")}</p>
            )}
          </section>

          <section className="rounded-[2rem] bg-brand-950 p-5 text-white shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">{t("roadEyebrow")}</p>
            <h2 className="mt-1 font-display text-lg font-bold">{t("roadTitle")}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-sm leading-6 text-white/80 marker:text-gold-300">
              <li>{t("road1")}</li>
              <li>{t("road2")}</li>
              <li>{t("road3")}</li>
              <li>{t("road4")}</li>
            </ul>
          </section>
        </aside>
      </div>

      <div className="mx-auto mt-6 max-w-6xl px-4 sm:px-6 lg:px-10">
        <CarRecommendations
          selected={listing}
          similarCars={recommendations.similarCars}
          similarPrice={recommendations.similarPrice}
          query={query}
        />
      </div>

      {/* Phone-only booking bar: the rental counter scrolls away on small
          screens, so the rate and the next step stay in reach. Same strip
          and stacking as StickyBookingBar (above BottomNav, over the
          language switcher and assistant launcher). */}
      <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[85] flex items-center justify-between gap-3 border-t border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-[0_-8px_24px_rgba(2,6,23,0.3)] backdrop-blur-md lg:hidden">
        <p className="font-mono text-lg font-bold tabular-nums text-emerald-300">
          {formatCost(listing.pricePerDay)}
          <span className="ms-1 font-sans text-xs font-medium text-white/60">{t("perDay")}</span>
        </p>
        <Link
          href={bookHref}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          {listing.instantBookEnabled ? t("bookNow") : t("requestBooking")}
        </Link>
      </div>
    </main>
  );
}
