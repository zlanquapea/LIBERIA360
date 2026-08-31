import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { MapPinIcon, TruckIcon } from "@heroicons/react/24/solid";
import { ApiError, getCarListingById } from "@/lib/api";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import { SafeImage } from "@/components/SafeImage";
import { BookingRequestSection } from "@/components/BookingRequestSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getCarListingById(id).catch(() => null);
  if (!listing) {
    return { title: "Request a car rental — LIBERIA360" };
  }
  return { title: `Request to rent ${listing.title} — LIBERIA360` };
}

// Dedicated page for the "Request to book" CTA on a car listing's detail
// page — same reasoning as businesses/[slug]/book: the full multi-field
// form (pickup/return dates, driver option, pickup location) needs real
// width to lay out, not a cramped tile.
export default async function BookCarListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const rentalParams = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const listing = await getCarListingById(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!listing) {
    notFound();
  }

  const business = listing.business;
  const location = business?.linkedPlace
    ? `${business.linkedPlace.city}, ${business.linkedPlace.county.name} County`
    : listing.county
      ? `${listing.county.name} County`
      : null;
  const coverPath = listing.images[0] ?? null;
  const cover = coverPath ? resolveImageUrl(coverPath) : null;
  const coverThumb = coverPath ? resolveThumbUrl(coverPath) : null;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 sm:py-10">
      <Link
        href={`/car-rentals/${listing.id}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        <ArrowLeftIcon aria-hidden className="h-4 w-4" />
        Back to {listing.title}
      </Link>

      <section className="flex flex-col gap-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-center gap-3">
          <SafeImage
            src={cover}
            thumbSrc={coverThumb}
            alt=""
            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
            fallback={
              <div
                aria-hidden
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-200 dark:bg-slate-700"
              >
                <TruckIcon className="h-6 w-6 text-slate-400" />
              </div>
            }
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold text-slate-950 dark:text-slate-50">
              {listing.title}
            </h1>
            {location && (
              <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                <MapPinIcon aria-hidden className="h-4 w-4 text-sky-500" />
                {location}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
              Request to rent
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Send your pickup and return dates —{" "}
              {business?.name ?? listing.owner?.name ?? "the owner"} will
              confirm or decline.
            </p>
          </div>
          <BookingRequestSection
            carListing={listing}
            prominent
            startExpanded
            returnTo={`/car-rentals/${listing.id}/book`}
            initialRentalDetails={{
              pickupDate: first(rentalParams.pickupDate),
              returnDate: first(rentalParams.returnDate),
              pickupLocation: first(rentalParams.pickupLocation),
            }}
          />
        </div>
      </section>
    </main>
  );
}
