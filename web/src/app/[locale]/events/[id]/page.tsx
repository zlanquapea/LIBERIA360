import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { ApiError, getEvent, getEventAttendees } from "@/lib/api";
import { formatCost, formatEventCategory, formatEventDateRange } from "@/lib/format";
import { EVENT_ACCENT, eventCountdown, eventPrice, eventStub, eventTimeLabel } from "@/lib/event-ticket";
import { absoluteImageUrl, resolveImageUrl } from "@/lib/images";
import { DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/site";
import { gradientForCategory } from "@/lib/category-colors";
import { directionsLink } from "@/lib/contact";
import { JsonLd } from "@/components/JsonLd";
import { eventJsonLd } from "@/lib/structured-data";
import { ReportButton } from "@/components/ReportButton";
import { EventOwnerActions } from "@/components/EventOwnerActions";
import { EventMiniMapLoader } from "@/components/EventMiniMapLoader";
import { EventRsvpButtons } from "@/components/EventRsvpButtons";
import { SafeImage } from "@/components/SafeImage";
import { EventViewTracker } from "@/components/EventViewTracker";
import { ShareMenu } from "@/components/ShareMenu";
import { AddToTripButton } from "@/components/AddToTripButton";
import { EventTicketPurchase } from "@/components/EventTicketPurchase";
import { AddToCalendar } from "@/components/AddToCalendar";
import { LrdHint } from "@/components/LrdHint";

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
  const title = `${event.name} — LIBERIA360 Events`;
  const description = event.description || undefined;
  const url = absoluteUrl(`/events/${event.id}`);
  const image = (event.images[0] ? absoluteImageUrl(event.images[0]) : null) ?? DEFAULT_OG_IMAGE;
  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      url,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

function attendeeInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

// An event page laid out like a festival poster with its ticket beside
// it: the poster up top with a countdown, then on wide screens the
// ticket — date stub, time, price, RSVP, buying tickets and adding it to
// a calendar — stays in view while you read about the event, the venue
// and who's organising it.
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("eventPage");
  const tt = await getTranslations("eventTicket");
  const locale = await getLocale();

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
  // The organizer's own pin takes priority; falls back to the linked
  // catalog Place's coordinates.
  const eventLatitude = event.latitude ?? event.place?.latitude ?? null;
  const eventLongitude = event.longitude ?? event.place?.longitude ?? null;
  const hasMap = eventLatitude !== null && eventLongitude !== null;
  const stub = eventStub(event.startDate, locale);
  const countdown = eventCountdown(event.startDate, event.endDate);
  const price = eventPrice(event);
  const accent = EVENT_ACCENT[event.category] ?? EVENT_ACCENT.other;
  const venue = event.place?.name ?? event.locationText ?? event.county.name;
  const venueLine = `${venue} · ${event.county.name}`;

  const countdownLabel =
    countdown?.kind === "live"
      ? tt("live")
      : countdown?.kind === "today"
        ? tt("today")
        : countdown?.kind === "tomorrow"
          ? tt("tomorrow")
          : countdown?.kind === "days"
            ? tt("inDays", { count: countdown.days })
            : null;

  const ticket = (
    <aside aria-label={t("ticketLabel")} className="lib-ticket flex flex-col">
      <div className="lib-ticket__top rounded-t-[1.75rem] bg-white p-5 dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <div aria-hidden className="flex w-16 shrink-0 flex-col items-center rounded-2xl bg-slate-50 py-2 text-center dark:bg-slate-800">
            <span className={`text-[11px] font-bold uppercase tracking-[0.18em] ${accent.text}`}>{stub.weekday}</span>
            <span className="font-display text-3xl font-black leading-none text-slate-950 dark:text-white">{stub.day}</span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{stub.month}</span>
          </div>
          <div className="min-w-0">
            <p className="sr-only">{formatEventDateRange(event.startDate, event.endDate)}</p>
            <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-50">
              <ClockIcon aria-hidden className="h-4 w-4 text-slate-400" />
              {eventTimeLabel(event.startDate, event.endDate, locale)}
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <MapPinIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>{venueLine}</span>
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{tt("admitOne")}</p>
            <p className={`font-display text-2xl font-black ${price.free ? "text-emerald-700 dark:text-emerald-300" : "text-slate-950 dark:text-white"}`}>
              {price.free ? t("freeAdmission") : tt("from", { price: formatCost(price.from) })}
            </p>
            {!price.free && <LrdHint usd={price.from} className="text-xs" />}
          </div>
          {price.free && <p className="max-w-[9rem] text-end text-xs text-slate-500 dark:text-slate-400">{t("freeNote")}</p>}
        </div>
      </div>
      <div className="lib-ticket__bottom relative flex flex-col gap-4 rounded-b-[1.75rem] bg-white p-5 dark:bg-slate-900">
        <span aria-hidden className="absolute inset-x-5 top-0 border-t-2 border-dashed border-slate-200 dark:border-slate-700" />
        <EventRsvpButtons
          eventId={event.id}
          initialStatus={null}
          initialInterestedCount={event.interestedCount}
          initialGoingCount={event.goingCount}
          variant="detail"
          hydrateFromServer
        />
        {attendees.length > 0 && (
          <div className="flex items-center gap-2">
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
                ? ` ${t("andMoreGoing", { count: event.goingCount - attendees.length })}`
                : attendees.length > 1
                  ? ` ${t("andMoreGoing", { count: attendees.length - 1 })}`
                  : ` ${t("isGoing")}`}
            </p>
          </div>
        )}
        {!price.free && (
          <a
            href="#tickets"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand-700 px-5 text-base font-bold text-white shadow-sm hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
          >
            {t("getTickets")}
          </a>
        )}
        <AddToCalendar
          event={{
            id: event.id,
            title: event.name,
            start: event.startDate,
            end: event.endDate,
            description: event.description,
            location: venueLine,
            url: absoluteUrl(`/events/${event.id}`),
          }}
        />
        <div className="flex items-center gap-2">
          <AddToTripButton contentType="event" itemId={event.id} itemName={event.name} />
          <ShareMenu placeName={event.name} contentType="event" />
        </div>
      </div>
    </aside>
  );

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      <JsonLd data={eventJsonLd(event)} />
      <EventViewTracker event={event} />

      {/* The poster. */}
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-brand-950 text-white shadow-card">
        <div className="absolute inset-0 -z-10">
          <SafeImage
            src={cover ?? null}
            alt=""
            loading="eager"
            className="h-full w-full object-cover"
            fallback={<div aria-hidden className="h-full w-full" style={{ backgroundImage: gradientForCategory(event.category) }} />}
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />
        </div>
        <div className="flex min-h-[22rem] flex-col justify-between gap-10 p-5 sm:min-h-[26rem] sm:p-8 lg:min-h-[30rem]">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/events"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-black/35 px-3 text-sm font-semibold ring-1 ring-white/25 backdrop-blur-md hover:bg-black/50"
            >
              <ArrowLeftIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
              {t("allEvents")}
            </Link>
            {countdownLabel && (
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
                  countdown?.kind === "live" ? "bg-flag-600" : countdown?.kind === "today" ? "bg-sunset-500" : "bg-black/35 ring-1 ring-white/25 backdrop-blur-md"
                }`}
              >
                {countdown?.kind === "live" && (
                  <span aria-hidden className="relative flex h-2 w-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
                    <span className="relative h-2 w-2 rounded-full bg-white" />
                  </span>
                )}
                {countdownLabel}
              </span>
            )}
          </div>
          <div className="max-w-3xl">
            <p className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-sunset-200">
              {formatEventCategory(event.category)}
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 tracking-[0.12em] text-white/90 ring-1 ring-inset ring-white/20">{price.free ? tt("free") : tt("from", { price: formatCost(price.from) })}</span>
            </p>
            <h1 className="mt-2 font-display text-[2rem] font-black leading-[1.05] tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] [overflow-wrap:anywhere] sm:text-5xl lg:text-6xl">
              {event.name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85 sm:text-base">
              <span className="flex items-center gap-1.5">
                <CalendarDaysIcon aria-hidden className="h-5 w-5" />
                {formatEventDateRange(event.startDate, event.endDate)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPinIcon aria-hidden className="h-5 w-5" />
                {venueLine}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
          <EventOwnerActions event={event} />

          {event.description && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-7 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{t("about")}</h2>
              <p className="mt-3 whitespace-pre-line leading-8 text-slate-700 dark:text-slate-200">{event.description}</p>
            </section>
          )}

          {!price.free && (
            <section id="tickets" className="scroll-mt-24">
              <EventTicketPurchase event={event} />
            </section>
          )}

          <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-7 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{t("where")}</h2>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  {event.place ? (
                    <Link href={`/places/${event.place.slug}`} className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                      {event.place.name}
                    </Link>
                  ) : (
                    <span className="font-semibold">{venue}</span>
                  )}
                  {" · "}
                  {t("county", { county: event.county.name })}
                </p>
              </div>
              {hasMap && (
                <a
                  href={directionsLink(eventLatitude as number, eventLongitude as number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800"
                >
                  <PaperAirplaneIcon aria-hidden className="h-4 w-4 -rotate-45" />
                  {t("directions")}
                </a>
              )}
            </div>
            {hasMap && (
              <div className="h-56 overflow-hidden rounded-2xl border border-slate-200 sm:h-72 dark:border-slate-800">
                <EventMiniMapLoader latitude={eventLatitude as number} longitude={eventLongitude as number} />
              </div>
            )}
          </section>

          {event.ticketInfo && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-7 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">{t("ticketInfo")}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{event.ticketInfo}</p>
            </section>
          )}

          {moreImages.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">{t("photos")}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {moreImages.map((img) => (
                  <SafeImage
                    key={img}
                    src={img}
                    alt={`${event.name} photo`}
                    className="aspect-square w-full rounded-2xl object-cover"
                    fallback={<div aria-hidden className="aspect-square w-full rounded-2xl bg-slate-200 dark:bg-slate-700" />}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            {event.createdBy ? (
              <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <UserCircleIcon aria-hidden className="h-6 w-6 text-slate-400" />
                {t("organisedBy", { name: event.createdBy.name })}
              </p>
            ) : (
              <span />
            )}
            <ReportButton targetType="event" targetId={event.id} />
          </div>
        </div>

        <div className="order-1 lg:sticky lg:top-24 lg:order-2">{ticket}</div>
      </div>
    </main>
  );
}
