import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  MapPinIcon,
} from "@heroicons/react/24/outline";
import { ApiError, getEvent, getEventAttendees } from "@/lib/api";
import { formatEventCategory, formatEventDateRange } from "@/lib/format";
import { resolveImageUrl } from "@/lib/images";
import { gradientForCategory } from "@/lib/category-colors";
import { JsonLd } from "@/components/JsonLd";
import { eventJsonLd } from "@/lib/structured-data";
import { ReportButton } from "@/components/ReportButton";
import { EventOwnerActions } from "@/components/EventOwnerActions";
import { EventRsvpButtons } from "@/components/EventRsvpButtons";
import { SafeImage } from "@/components/SafeImage";
import { EventViewTracker } from "@/components/EventViewTracker";
import { ShareMenu } from "@/components/ShareMenu";
import { EventTicketPurchase } from "@/components/EventTicketPurchase";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id).catch(() => null);
  if (!event) {
    return { title: "Event — LIBERIA360" };
  }
  return {
    title: `${event.name} — LIBERIA360 Events`,
    description: event.description || undefined,
  };
}

function attendeeInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = await getEvent(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!event) {
    notFound();
  }

  const attendees = await getEventAttendees(id);
  const gallery = event.images.map(resolveImageUrl);
  const [cover, ...moreImages] = gallery;
  const hasStats = event.interestedCount > 0 || event.goingCount > 0;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/events"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-brand-300 dark:hover:bg-brand-950/30"
        >
          <ArrowLeftIcon aria-hidden className="h-4 w-4" />
          All events
        </Link>
        <ShareMenu placeName={event.name} contentType="event" />
      </div>
      <JsonLd data={eventJsonLd(event)} />
      <EventViewTracker event={event} />

      {/* Facebook-style event page: one large cover photo up top (the
          "poster" a real event flyer or venue shot reads as) instead of
          every uploaded image in an equal-sized grid — extra images, if
          any, still show further down as a smaller gallery. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
        <SafeImage
          src={cover ?? null}
          alt={`${event.name} cover photo`}
          className="h-full w-full object-cover"
          fallback={
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundImage: gradientForCategory(event.category) }}
            >
              <CalendarDaysIcon
                aria-hidden
                className="h-16 w-16 text-white/70"
              />
            </div>
          }
        />
      </div>

      <div className="flex items-center gap-2"><span className="w-fit rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">{formatEventCategory(event.category)}</span><span className={`rounded-full px-3 py-1 text-xs font-black tracking-wide ${event.ticketTypes?.length || event.ticketPrice ? 'bg-brand-700 text-white' : 'bg-emerald-100 text-emerald-800'}`}>{event.ticketTypes?.length || event.ticketPrice ? 'PAID EVENT' : 'FREE'}</span></div>

      <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
        {event.name}
      </h1>

      <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
        <p className="flex items-center gap-1.5">
          <CalendarDaysIcon
            aria-hidden
            className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300"
          />
          {formatEventDateRange(event.startDate, event.endDate)}
        </p>
        <p className="flex items-center gap-1.5">
          <MapPinIcon
            aria-hidden
            className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300"
          />
          {event.place ? (
            <Link
              href={`/places/${event.place.slug}`}
              className="text-brand-700 dark:text-brand-300 hover:underline"
            >
              {event.place.name}
            </Link>
          ) : (
            event.locationText
          )}{" "}
          · {event.county.name} County
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
        {!event.ticketTypes?.length && !event.ticketPrice && <div className="mb-3 flex items-center justify-between rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/30"><div><p className="font-bold text-emerald-900 dark:text-emerald-100">Free admission</p><p className="text-xs text-emerald-700 dark:text-emerald-300">Reserve your spot—no payment required.</p></div><span className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Register Free</span></div>}
        {hasStats && (
          <p className="pb-2 text-sm text-slate-500 dark:text-slate-400">
            {event.interestedCount > 0 && `${event.interestedCount} interested`}
            {event.interestedCount > 0 && event.goingCount > 0 && " · "}
            {event.goingCount > 0 && `${event.goingCount} going`}
          </p>
        )}
        <EventRsvpButtons
          eventId={event.id}
          initialStatus={null}
          initialInterestedCount={event.interestedCount}
          initialGoingCount={event.goingCount}
          variant="detail"
          hydrateFromServer
        />
        {attendees.length > 0 && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex -space-x-2">
              {attendees.map((attendee) => (
                <span
                  key={attendee.id}
                  title={attendee.name}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-xs font-bold text-brand-800 dark:border-slate-900 dark:bg-brand-900 dark:text-brand-200"
                >
                  {attendeeInitial(attendee.name)}
                </span>
              ))}
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {attendees[0].name}
              {event.goingCount > attendees.length
                ? ` and ${event.goingCount - attendees.length} more going`
                : attendees.length > 1
                  ? ` and ${attendees.length - 1} more going`
                  : " is going"}
            </p>
          </div>
        )}
      </div>

      {moreImages.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {moreImages.map((img) => (
            <SafeImage
              key={img}
              src={img}
              alt={`${event.name} photo`}
              className="aspect-square w-full rounded-lg object-cover"
              fallback={
                <div
                  aria-hidden
                  className="aspect-square w-full rounded-lg bg-slate-200 dark:bg-slate-700"
                />
              }
            />
          ))}
        </div>
      )}

      <EventOwnerActions event={event} />

      {event.description && (
        <p className="text-slate-700 dark:text-slate-200">
          {event.description}
        </p>
      )}

      {event.ticketInfo && (
        <section className="flex flex-col gap-1 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Tickets
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {event.ticketInfo}
          </p>
        </section>
      )}

      <EventTicketPurchase event={event} />

      <div className="flex items-center justify-between gap-2">
        {event.createdBy ? (
          <p className="text-xs text-slate-400 dark:text-slate-400">
            Posted by {event.createdBy.name}
          </p>
        ) : (
          <span />
        )}
        <ReportButton targetType="event" targetId={event.id} />
      </div>
    </main>
  );
}
