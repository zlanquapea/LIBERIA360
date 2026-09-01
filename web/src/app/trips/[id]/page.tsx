import { getPublicTrip } from '@/lib/itinerary-api';
import { TripDetailClient } from '@/components/TripDetailClient';

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
  return {
    title: `${trip.title} — LIBERIA360`,
    description: trip.description ?? undefined,
  };
}

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripDetailClient id={id} />;
}
