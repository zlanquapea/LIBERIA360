import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  MapPinIcon,
  PhoneIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { CalendarDaysIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import { ApiError, getCarListingById, getCarListingReviews } from '@/lib/api';
import {
  formatCarCategory,
  formatCarFuelType,
  formatCarTransmission,
  formatCost,
} from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { SafeImage } from '@/components/SafeImage';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BookingRequestSection } from '@/components/BookingRequestSection';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getCarListingById(id).catch(() => null);
  if (!listing) {
    return { title: 'Car Rental — LIBERIA360' };
  }
  return { title: `${listing.title} — LIBERIA360` };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">{title}</h2>
      {children}
    </section>
  );
}

export default async function CarListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const listing = await getCarListingById(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!listing) {
    notFound();
  }

  const reviewsResult = await getCarListingReviews(listing.id, { limit: 20 });
  const images = listing.images.map(resolveImageUrl);
  const cover = images[0] ?? null;
  const business = listing.business;
  // Every listing has a direct county now (see CarListing's doc comment);
  // the linked business's place, if any, is more specific and wins when
  // present.
  const location = business?.linkedPlace
    ? `${business.linkedPlace.city}, ${business.linkedPlace.county.name} County`
    : listing.county
      ? `${listing.county.name} County`
      : null;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 bg-slate-50/70 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 dark:bg-slate-950/20">
      <Link
        href="/car-rentals"
        className="flex w-fit items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeftIcon aria-hidden className="h-4 w-4" />
        Back to Car Rentals
      </Link>

      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
        <SafeImage
          src={cover}
          alt=""
          className="h-full w-full object-cover"
          fallback={<TruckIcon aria-hidden className="h-16 w-16 text-slate-400 dark:text-slate-500" />}
        />
      </div>

      {images.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {images.slice(1).map((src) => (
            <div
              key={src}
              className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <SafeImage
                src={src}
                alt=""
                className="h-full w-full object-cover"
                fallback={<TruckIcon aria-hidden className="h-6 w-6 text-slate-400 dark:text-slate-500" />}
              />
            </div>
          ))}
        </div>
      )}

      <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            {formatCarCategory(listing.category)}
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
            {listing.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {listing.year} {listing.make} {listing.model}
          </p>
        </div>

        {location && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
            <MapPinIcon aria-hidden className="h-4 w-4 text-sky-500" />
            {location}
          </p>
        )}

        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-3xl font-bold text-slate-950 dark:text-slate-50">
            {formatCost(listing.pricePerDay)}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">per day</span>
          {listing.minRentalDays > 1 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              · {listing.minRentalDays}-day minimum
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-4">
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <UserGroupIcon aria-hidden className="h-5 w-5 text-sky-500" />
            {listing.seats} seats
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <TruckIcon aria-hidden className="h-5 w-5 text-sky-500" />
            {formatCarTransmission(listing.transmission)}
          </div>
          <div className="text-sm text-slate-700 dark:text-slate-200">{formatCarFuelType(listing.fuelType)}</div>
          {listing.withDriverAvailable && (
            <div className="text-sm text-slate-700 dark:text-slate-200">
              Driver +{formatCost(listing.driverFeePerDay)}/day
            </div>
          )}
        </div>

        {listing.securityDeposit != null && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Refundable security deposit: {formatCost(listing.securityDeposit)}
          </p>
        )}

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <BookingRequestSection
            carListing={listing}
            prominent
            mode="link"
            href={`/car-rentals/${listing.id}/book`}
          />
        </div>
      </header>

      {listing.description && (
        <Section title="About this vehicle">
          <p className="whitespace-pre-wrap leading-8 text-slate-700 dark:text-slate-200">{listing.description}</p>
        </Section>
      )}

      {listing.features.length > 0 && (
        <Section title="Features">
          <div className="flex flex-wrap gap-2">
            {listing.features.map((feature) => (
              <span
                key={feature}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {feature}
              </span>
            ))}
          </div>
        </Section>
      )}

      {listing.pickupLocation && (
        <Section title="Pickup">
          <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <CalendarDaysIcon aria-hidden className="h-4 w-4 text-sky-500" />
            {listing.pickupLocation}
          </p>
        </Section>
      )}

      {business ? (
        <Section title="Rented out by">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Link
                href={`/businesses/${business.slug}`}
                className="font-semibold text-slate-950 hover:underline dark:text-slate-50"
              >
                {business.name}
              </Link>
              {location && <p className="text-sm text-slate-500 dark:text-slate-400">{location}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {business.whatsapp && (
                <a
                  href={whatsappLink(business.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30"
                >
                  <PhoneIcon aria-hidden className="h-4 w-4" />
                  Call
                </a>
              )}
            </div>
          </div>
        </Section>
      ) : (
        // The common case: an individual lister with no claimed Business
        // (see CarListing's doc comment) — same "Rented out by" section,
        // but the owner's name and their own direct contact fields
        // instead of a business profile link.
        (listing.owner || listing.contactWhatsapp || listing.contactPhone) && (
          <Section title="Rented out by">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950 dark:text-slate-50">{listing.owner?.name ?? 'Vehicle owner'}</p>
                {location && <p className="text-sm text-slate-500 dark:text-slate-400">{location}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {listing.contactWhatsapp && (
                  <a
                    href={whatsappLink(listing.contactWhatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                {listing.contactPhone && (
                  <a
                    href={`tel:${listing.contactPhone}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-950/30"
                  >
                    <PhoneIcon aria-hidden className="h-4 w-4" />
                    Call
                  </a>
                )}
              </div>
            </div>
          </Section>
        )
      )}

      <Section title="Reviews">
        <ReviewsSection carListingId={listing.id} initialReviews={reviewsResult.data} />
      </Section>
    </main>
  );
}
