"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  TicketIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { getMyTripBooking, type TripBooking } from "@/lib/group-trips-api";
import {
  PAYMENT_METHOD_LABELS,
  clock,
  countdown,
  dateRange,
  itemIcon,
  money,
  priceLabel,
  shortDate,
  slotsHeadline,
  telLink,
  tripNights,
  whatsappLink,
} from "@/lib/group-trips";
import { resolveImageUrl } from "@/lib/images";
import { tripHasMapPins } from "@/lib/trip-map";
import type { PublicTripDetail, TripHosting } from "@/lib/types";
import { SafeImage } from "@/components/SafeImage";
import { ShareMenu } from "@/components/ShareMenu";
import { TripTimeline } from "@/components/trips/TripTimeline";
import { TripMapLoader } from "@/components/TripMapLoader";
import { BookSpotSheet, METHOD_ICON } from "./BookSpotSheet";
import { PriceSeal, SpotsMeter } from "./HostedTripCard";

type HostedTrip = PublicTripDetail & { hosting: TripHosting };

function Section({
  eyebrow,
  title,
  children,
  id,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card sm:p-7 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50"
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** Photos for the poster strip: the organiser's own, then the places on the plan. */
function stripPhotos(trip: HostedTrip) {
  const out = [...trip.hosting.gallery];
  for (const s of trip.stops) {
    const img = s.place?.images?.[0] ?? s.event?.images?.[0];
    if (img) out.push(img);
  }
  if (trip.destination) out.push(...trip.destination.images);
  return [...new Set(out)].filter((p) => p !== trip.coverImage).slice(0, 4);
}

/**
 * An organised trip's own page, laid out like the posters these trips
 * are shared as on WhatsApp and Instagram: the organisers' logos, the big
 * title and tagline, the date pill, the price sticker and "only N spots
 * left", then what's included, the activities, the destination, the plan
 * and how to pay. One button books — or shows your ticket if you already
 * have one.
 */
export function HostedTripPage({ trip }: { trip: HostedTrip }) {
  const h = trip.hosting;
  const { user, ready } = useAuth();
  const [booking, setBooking] = useState<TripBooking | null>(null);
  const [open, setOpen] = useState(false);
  const cover =
    trip.coverImage ?? h.gallery[0] ?? trip.destination?.images[0] ?? null;
  const photos = useMemo(() => stripPhotos(trip), [trip]);
  const nights = tripNights(trip.startDate, trip.endDate);
  const leaves = countdown(trip.startDate);
  const isOrganiser = user?.id === trip.admin?.id;

  useEffect(() => {
    if (!ready || !user || isOrganiser) return;
    getMyTripBooking(trip.id)
      .then(setBooking)
      .catch(() => setBooking(null));
  }, [ready, user, isOrganiser, trip.id]);

  const activeBooking =
    booking && ["pending", "confirmed", "waitlisted"].includes(booking.status)
      ? booking
      : null;
  const closedReason =
    trip.status === "cancelled"
      ? "This trip was cancelled"
      : trip.status !== "upcoming"
        ? "This trip has already left"
        : !h.open
          ? "Bookings are closed"
          : h.bookingDeadline &&
              h.bookingDeadline < new Date().toISOString().slice(0, 10)
            ? "Bookings have closed"
            : null;

  const cta = isOrganiser ? (
    <Link
      href={`/trips/${trip.id}/host`}
      className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-gold-400 px-6 text-base font-black text-slate-950 hover:bg-gold-300"
    >
      Open your trip desk <ArrowRightIcon aria-hidden className="h-5 w-5" />
    </Link>
  ) : activeBooking ? (
    <Link
      href={`/account/trip-bookings/${activeBooking.id}`}
      className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-base font-black text-slate-950 hover:bg-emerald-400"
    >
      <TicketIcon aria-hidden className="h-5 w-5" />
      {activeBooking.status === "waitlisted"
        ? "You're on the waitlist"
        : "View your ticket"}
    </Link>
  ) : closedReason ? (
    <p className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-white/15 px-6 text-sm font-bold text-white">
      {closedReason}
    </p>
  ) : !user ? (
    <Link
      href={`/login?next=/trips/${trip.id}`}
      className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-gold-400 px-6 text-base font-black uppercase tracking-wide text-slate-950 hover:bg-gold-300"
    >
      Log in to book
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-gold-400 px-6 text-base font-black uppercase tracking-wide text-slate-950 shadow-lg shadow-gold-500/30 hover:bg-gold-300"
    >
      {h.spotsLeft <= 0 ? "Join the waitlist" : "Secure your spot"}
    </button>
  );

  const shareText = `${trip.title} — ${dateRange(trip.startDate, trip.endDate)}, ${priceLabel(h)}. ${h.spotsLeft > 0 ? `Only ${h.spotsLeft} spots left!` : ""}`;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-48 pt-4 sm:px-6 lg:pb-28">
      <Link
        href="/trips/community"
        className="w-fit text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
      >
        ← Group trips
      </Link>

      {/* The poster */}
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        {cover && (
          <SafeImage
            src={resolveImageUrl(cover)}
            alt=""
            loading="eager"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
            fallback={null}
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/40 via-slate-950/55 to-[#1d2a12]"
        />
        <div className="flex flex-col items-center gap-5 px-5 pb-7 pt-6 text-center sm:px-10 sm:pb-10 sm:pt-8">
          {h.organisers.length > 0 && (
            <ul
              aria-label="Organised by"
              className="flex flex-wrap items-center justify-center gap-3"
            >
              {h.organisers.map((o) => (
                <li
                  key={o.name}
                  className="flex items-center gap-2 rounded-full bg-white/90 py-1 pe-3 ps-1 text-xs font-bold text-slate-900 shadow"
                >
                  {o.logo ? (
                    <SafeImage
                      src={resolveImageUrl(o.logo)}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                      fallback={null}
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-[11px] font-black text-white"
                    >
                      {o.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {o.name}
                </li>
              ))}
            </ul>
          )}

          <h1 className="max-w-3xl font-display text-4xl font-black uppercase leading-[0.95] tracking-tight [overflow-wrap:anywhere] [text-shadow:0_4px_0_rgba(0,0,0,0.35)] sm:text-6xl">
            {trip.title}
          </h1>
          {h.tagline && (
            <p className="-mt-1 rounded-2xl bg-slate-950 px-5 py-2 font-display text-base font-black uppercase tracking-wide sm:text-xl">
              {h.tagline}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-4">
            <p className="flex items-center gap-2 rounded-full border-2 border-white/90 px-5 py-2.5 font-display text-lg font-black uppercase tracking-wide sm:text-2xl">
              <CalendarDaysIcon aria-hidden className="h-6 w-6" />
              {dateRange(trip.startDate, trip.endDate)}
            </p>
            <PriceSeal hosting={h} size="lg" />
          </div>

          <p className="font-display text-sm font-bold uppercase tracking-[0.35em] text-gold-200 sm:text-base">
            {slotsHeadline(h)}
          </p>
          <div className="w-full max-w-sm">
            <SpotsMeter hosting={h} tone="dark" label={false} />
          </div>

          {(h.includes.length > 0 || h.activities.length > 0) && (
            <div className="grid w-full max-w-3xl gap-5 text-start sm:grid-cols-2 sm:divide-x sm:divide-gold-400/60">
              {h.includes.length > 0 && (
                <div className="sm:pe-5">
                  <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-gold-300">
                    Inclusive of
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {h.includes.map((item) => (
                      <li
                        key={item}
                        className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold ring-1 ring-white/20"
                      >
                        <span aria-hidden>{itemIcon(item, "✓")} </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {h.activities.length > 0 && (
                <div className="sm:ps-5">
                  <p className="font-display text-sm font-black uppercase tracking-[0.18em] text-gold-300">
                    Activities
                  </p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {h.activities.map((a) => (
                      <li
                        key={a}
                        className="text-sm font-semibold uppercase tracking-wide"
                      >
                        <span aria-hidden>{itemIcon(a)} </span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {photos.length > 0 && (
            <div
              aria-hidden
              className="grid w-full grid-cols-4 gap-2 pt-1 sm:gap-3"
            >
              {photos.map((p, i) => (
                <div
                  key={p}
                  className={`h-20 overflow-hidden rounded-xl sm:h-32 ${i % 2 ? "-skew-x-6" : "skew-x-6"} ring-2 ring-white/20`}
                >
                  <SafeImage
                    src={resolveImageUrl(p)}
                    alt=""
                    className={`h-full w-full scale-125 object-cover ${i % 2 ? "skew-x-6" : "-skew-x-6"}`}
                    fallback={null}
                  />
                </div>
              ))}
            </div>
          )}

          <p className="font-display text-sm font-black uppercase tracking-wide text-gold-300 sm:text-lg">
            Secure your spot. Pack your bags. Let&apos;s go.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {trip.destination && (
            <Section
              eyebrow="Where you're going"
              title={trip.destination.name}
              id="trip-destination"
            >
              <Link
                href={`/places/${trip.destination.slug}`}
                className="group grid overflow-hidden rounded-3xl border border-slate-200 sm:grid-cols-[14rem_minmax(0,1fr)] dark:border-slate-800"
              >
                <div className="aspect-[4/3] overflow-hidden sm:aspect-auto">
                  <SafeImage
                    src={
                      trip.destination.images[0]
                        ? resolveImageUrl(trip.destination.images[0])
                        : null
                    }
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    fallback={
                      <div className="flex h-full min-h-32 items-center justify-center bg-brand-50 text-5xl dark:bg-brand-950/40">
                        🏝️
                      </div>
                    }
                  />
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-300">
                    <MapPinIcon aria-hidden className="h-4 w-4" />
                    {trip.destination.county.name} County ·{" "}
                    {trip.destination.category.name}
                  </p>
                  <p className="line-clamp-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {trip.destination.description}
                  </p>
                  <span className="mt-auto flex items-center gap-1 text-sm font-bold text-brand-700 group-hover:underline dark:text-brand-300">
                    Explore {trip.destination.name}{" "}
                    <ArrowRightIcon aria-hidden className="h-4 w-4" />
                  </span>
                </div>
              </Link>
              {tripHasMapPins(trip.stops) && (
                <div className="h-60 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800">
                  <TripMapLoader stops={trip.stops} />
                </div>
              )}
            </Section>
          )}

          {(trip.description || trip.stops.length > 0) && (
            <Section
              eyebrow={
                nights
                  ? `${nights + 1} days · ${nights} ${nights === 1 ? "night" : "nights"}`
                  : "The plan"
              }
              title="Day by day"
              id="trip-plan"
            >
              {trip.description && (
                <p className="whitespace-pre-line leading-7 text-slate-700 dark:text-slate-200">
                  {trip.description}
                </p>
              )}
              {trip.stops.length > 0 && (
                <TripTimeline stops={trip.stops} startDate={trip.startDate} />
              )}
            </Section>
          )}

          {(h.excludes.length > 0 || h.goodToKnow) && (
            <Section
              eyebrow="Before you book"
              title="Good to know"
              id="trip-good-to-know"
            >
              {h.goodToKnow && (
                <p className="whitespace-pre-line leading-7 text-slate-700 dark:text-slate-200">
                  {h.goodToKnow}
                </p>
              )}
              {h.excludes.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Not included
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {h.excludes.map((x) => (
                      <li
                        key={x}
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Per person
                </p>
                <p className="font-display text-3xl font-black text-slate-950 dark:text-white">
                  {priceLabel(h)}
                </p>
              </div>
              {leaves && (
                <p className="rounded-full bg-sunset-100 px-3 py-1 text-xs font-bold text-sunset-900 dark:bg-sunset-950/50 dark:text-sunset-200">
                  {leaves}
                </p>
              )}
            </div>
            {!h.isFree && h.depositAmount != null && (
              <p className="rounded-2xl bg-brand-50 px-3 py-2 text-sm text-brand-900 dark:bg-brand-950/40 dark:text-brand-100">
                🎟️ Hold your spot with{" "}
                <strong>{money(h.depositAmount, h.currency)}</strong>, pay the
                rest
                {h.balanceDueDate
                  ? ` by ${shortDate(h.balanceDueDate)}`
                  : " before the trip"}
                .
              </p>
            )}
            <SpotsMeter hosting={h} />
            <dl className="flex flex-col gap-3 text-sm">
              {(h.meetingPoint || h.departureTime) && (
                <div className="flex gap-3">
                  <dt className="sr-only">Departure</dt>
                  <ClockIcon
                    aria-hidden
                    className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"
                  />
                  <dd className="text-slate-700 dark:text-slate-200">
                    <span className="font-semibold text-slate-950 dark:text-slate-50">
                      Leaves {trip.startDate ? shortDate(trip.startDate) : ""}
                      {h.departureTime ? ` at ${clock(h.departureTime)}` : ""}
                    </span>
                    {h.meetingPoint && (
                      <span className="block">from {h.meetingPoint}</span>
                    )}
                  </dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="sr-only">Travellers</dt>
                <UserGroupIcon
                  aria-hidden
                  className="mt-0.5 h-5 w-5 shrink-0 text-brand-600"
                />
                <dd className="text-slate-700 dark:text-slate-200">
                  {h.spotsBooked > 0
                    ? `${h.spotsBooked} ${h.spotsBooked === 1 ? "person is" : "people are"} going`
                    : "Be the first to book"}
                </dd>
              </div>
            </dl>
            {!h.isFree && h.paymentOptions.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Pay your way
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {h.paymentOptions.map((o) => (
                    <li
                      key={o.method}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-700"
                    >
                      <span aria-hidden className="text-brand-700">
                        {METHOD_ICON[o.method]}
                      </span>
                      {PAYMENT_METHOD_LABELS[o.method]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Organised by
            </p>
            <p className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
              {h.organisers.length > 0
                ? h.organisers.map((o) => o.name).join(" × ")
                : trip.admin?.name}
            </p>
            {trip.admin && h.organisers.length > 0 && (
              <p className="-mt-2 text-xs text-slate-500">
                Hosted on LIBERIA360 by {trip.admin.name}
              </p>
            )}
            {h.contactPhone && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={telLink(h.contactPhone)}
                  className="flex min-h-10 items-center gap-1.5 rounded-full border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
                >
                  <PhoneIcon aria-hidden className="h-4 w-4" /> Call
                </a>
                <a
                  href={whatsappLink(
                    h.contactPhone,
                    `Hi! I'm interested in "${trip.title}".`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-10 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-white"
                >
                  <ChatBubbleOvalLeftEllipsisIcon
                    aria-hidden
                    className="h-4 w-4"
                  />{" "}
                  WhatsApp
                </a>
              </div>
            )}
            <div className="flex items-center gap-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
              <div className="h-10 w-10">
                <ShareMenu placeName={trip.title} contentType="trip" />
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${typeof window !== "undefined" ? window.location.href : ""}`)}`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Share on WhatsApp
              </a>
            </div>
          </div>
        </aside>
      </div>

      {/* Always-there booking bar */}
      <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[85] border-t border-white/10 bg-slate-950/95 px-4 py-3 text-white shadow-[0_-8px_24px_rgba(15,23,42,0.25)] backdrop-blur lg:bottom-0 lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 lg:justify-between [&>*:last-child]:lg:max-w-sm">
          <div className="min-w-0">
            <p className="font-display text-xl font-black leading-tight">
              {priceLabel(h)}
            </p>
            <p className="truncate text-xs text-white/70">
              {dateRange(trip.startDate, trip.endDate)} ·{" "}
              {h.spotsLeft > 0 ? `${h.spotsLeft} left` : "Waitlist"}
            </p>
          </div>
          {cta}
        </div>
      </div>

      {user && !isOrganiser && (
        <BookSpotSheet
          open={open}
          onClose={() => setOpen(false)}
          tripId={trip.id}
          tripTitle={trip.title}
          hosting={h}
        />
      )}
    </main>
  );
}
