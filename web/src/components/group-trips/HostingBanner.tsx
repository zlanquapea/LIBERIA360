"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRightIcon,
  MegaphoneIcon,
  TicketIcon,
} from "@heroicons/react/24/outline";
import { getMyTripBooking, type TripBooking } from "@/lib/group-trips-api";
import { TRAVELLER_STATUS_LABELS, priceLabel } from "@/lib/group-trips";
import type { ItineraryDetail } from "@/lib/types";

/**
 * The strip at the top of a trip's own workspace that links it to the
 * organised-trip side: the organiser's desk, an invitation to open the
 * trip for bookings, or a traveller's ticket.
 */
export function HostingBanner({
  trip,
  isOwner,
}: {
  trip: ItineraryDetail;
  isOwner: boolean;
}) {
  const h = trip.hosting ?? null;
  const [booking, setBooking] = useState<TripBooking | null>(null);

  useEffect(() => {
    if (isOwner || !h) return;
    getMyTripBooking(trip.id)
      .then(setBooking)
      .catch(() => setBooking(null));
  }, [isOwner, h, trip.id]);

  if (isOwner && h)
    return (
      <div className="flex flex-col gap-3 rounded-3xl bg-slate-950 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-300">
            Organised trip · {priceLabel(h)}
          </p>
          <p className="font-display text-xl font-black">
            {h.spots - h.spotsLeft} of {h.spots} spots booked
          </p>
          {!h.open && (
            <p className="text-xs text-white/70">Bookings are closed</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/trips/${trip.id}?view=public`}
            className="flex min-h-10 items-center rounded-full border border-white/30 px-4 text-sm font-semibold"
          >
            Trip page
          </Link>
          <Link
            href={`/trips/${trip.id}/host`}
            className="flex min-h-10 items-center gap-1.5 rounded-full bg-gold-400 px-4 text-sm font-black text-slate-950"
          >
            Open trip desk <ArrowRightIcon aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );

  if (isOwner && trip.status === "upcoming" && !trip.isFeaturedTemplate)
    return (
      <Link
        href={`/trips/${trip.id}/host`}
        className="flex items-center gap-3 rounded-3xl border border-dashed border-brand-300 bg-brand-50/60 p-4 hover:border-brand-500 dark:border-brand-800 dark:bg-brand-950/30"
      >
        <MegaphoneIcon
          aria-hidden
          className="h-8 w-8 shrink-0 text-brand-700 dark:text-brand-300"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-slate-950 dark:text-slate-50">
            Organising this for a group?
          </span>
          <span className="block text-sm text-slate-600 dark:text-slate-300">
            Open it for bookings — free or paid. Take cash, MTN MoMo or Orange
            Money and follow every spot.
          </span>
        </span>
        <ArrowRightIcon
          aria-hidden
          className="h-5 w-5 shrink-0 text-brand-700"
        />
      </Link>
    );

  if (booking)
    return (
      <Link
        href={`/account/trip-bookings/${booking.id}`}
        className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-4 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-100"
      >
        <TicketIcon aria-hidden className="h-7 w-7 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Your ticket · #{booking.code}</span>
          <span className="block text-sm">
            {TRAVELLER_STATUS_LABELS[booking.status]}
          </span>
        </span>
        <ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0" />
      </Link>
    );
  return null;
}
