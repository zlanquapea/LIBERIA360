import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { MapPinIcon } from "@heroicons/react/24/solid";
import { ApiError, getBusinessBySlug } from "@/lib/api";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import { SafeImage } from "@/components/SafeImage";
import { BookingRequestSection } from "@/components/BookingRequestSection";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug).catch(() => null);
  if (!business) {
    return { title: "Request a booking — LIBERIA360" };
  }
  return { title: `Request to book ${business.name} — LIBERIA360` };
}

// Dedicated page for the "Book" action on a place/business profile (see
// PlaceKeyFacts.tsx and businesses/[slug]/page.tsx's Directions/Call/
// WhatsApp/Book action-tile grid). BookingRequestSection's multi-field
// form used to expand in place inside one cell of that grid — nowhere
// near enough width, so the date/check-out fields wrapped and the whole
// grid went lopsided (reported: "the page appear badly" on tapping Book).
// The form now gets a full page to lay out properly; every other state
// (login prompt, "you manage this listing", sent confirmation) is short
// enough to keep rendering inline in the tile itself — see that
// component's `mode` prop.
export default async function BookBusinessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const business = await getBusinessBySlug(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!business) {
    notFound();
  }

  const place = business.linkedPlace;
  const coverPath = business.images[0] ?? place.images[0] ?? null;
  const cover = coverPath ? resolveImageUrl(coverPath) : null;
  const coverThumb = coverPath ? resolveThumbUrl(coverPath) : null;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-6 sm:py-10">
      <Link
        href={`/businesses/${business.slug}`}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        <ArrowLeftIcon aria-hidden className="h-4 w-4" />
        Back to {business.name}
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
                className="h-14 w-14 shrink-0 rounded-2xl bg-slate-200 dark:bg-slate-700"
              />
            }
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-bold text-slate-950 dark:text-slate-50">
              {business.name}
            </h1>
            <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <MapPinIcon aria-hidden className="h-4 w-4 text-sky-500" />
              {place.city}, {place.county.name} County
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
              Request to book
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Send {business.name} your dates and party size.
            </p>
          </div>
          <BookingRequestSection
            business={business}
            prominent
            startExpanded
            returnTo={`/businesses/${business.slug}/book`}
          />
        </div>
      </section>
    </main>
  );
}
