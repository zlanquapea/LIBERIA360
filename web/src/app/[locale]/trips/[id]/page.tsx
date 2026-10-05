import { getPublicTrip } from '@/lib/itinerary-api';
import { absoluteImageUrl } from '@/lib/images';
import { DEFAULT_OG_IMAGE, absoluteUrl } from '@/lib/site';
import { TripDetailClient } from '@/components/TripDetailClient';
import { dateRange, priceLabel } from '@/lib/group-trips';

// Server wrapper so a shared trip link gets a real preview card (title +
// description) when pasted into Facebook/WhatsApp/X/etc — those crawlers
// only read <head> metadata from the initial HTML, which a 'use client'
// page (TripDetailClient, needed for the member/public/restricted
// branching) can never produce on its own. Deliberately generic for a
// private trip or a nonexistent id: getPublicTrip resolves a private trip
// to a RestrictedTripPreview (no title/description), and we don't want a
// scraped preview leaking either that a private trip exists or its title.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getPublicTrip(id).catch(() => null);
  if (!trip || 'visibility' in trip) {
    return { title: 'Trip — LIBERIA360' };
  }
  const title = `${trip.title} — LIBERIA360`;
  // An organised trip's link preview reads like its poster: when, how
  // much, and how many spots are left.
  const h = trip.hosting;
  const description = h
    ? [
        h.tagline,
        `${dateRange(trip.startDate, trip.endDate)} · ${priceLabel(h)}${h.isFree ? '' : ' per person'} · ${h.spotsLeft > 0 ? `${h.spotsLeft} spots left` : 'fully booked'}`,
        trip.description,
      ]
        .filter(Boolean)
        .join(' — ')
    : (trip.description ?? undefined);
  const url = absoluteUrl(`/trips/${trip.id}`);
  const coverPath = trip.coverImage ?? trip.destination?.images[0] ?? null;
  const image = (coverPath ? absoluteImageUrl(coverPath) : null) ?? DEFAULT_OG_IMAGE;
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  return <TripDetailClient id={id} publicView={view === 'public'} />;
}
