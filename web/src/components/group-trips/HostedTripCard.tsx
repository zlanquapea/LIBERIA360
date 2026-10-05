import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import type { PublicTripSummary, TripHosting } from "@/lib/types";
import { resolveImageUrl } from "@/lib/images";
import { SafeImage } from "@/components/SafeImage";
import {
  countdown,
  dateRange,
  fillPercent,
  priceLabel,
  spotsMessage,
} from "@/lib/group-trips";

/** The price stamped on the corner of the poster — like a sticker. */
export function PriceSeal({
  hosting,
  size = "md",
}: {
  hosting: Pick<TripHosting, "isFree" | "price" | "currency">;
  size?: "md" | "lg";
}) {
  const big = size === "lg";
  return (
    <span
      className={`flex shrink-0 rotate-[-8deg] flex-col items-center justify-center rounded-full bg-gold-400 text-center font-black leading-none text-slate-950 shadow-lg ring-4 ring-gold-300/60 ring-offset-2 ring-offset-gold-400 ${
        big ? "h-24 w-24 sm:h-28 sm:w-28" : "h-16 w-16"
      }`}
    >
      <span
        className={`uppercase tracking-wider ${big ? "text-[11px]" : "text-[9px]"}`}
      >
        {hosting.isFree ? "Entry" : "Cost"}
      </span>
      <span
        className={`font-display ${big ? "text-2xl sm:text-3xl" : "text-base"} italic`}
      >
        {priceLabel(hosting).replace(/^US\$/, "$")}
      </span>
    </span>
  );
}

/** How full the trip is, as a bar and a line. */
export function SpotsMeter({
  hosting,
  tone = "light",
  label = true,
}: {
  hosting: Pick<TripHosting, "spots" | "spotsLeft">;
  tone?: "light" | "dark";
  label?: boolean;
}) {
  const pct = fillPercent(hosting);
  const urgent =
    hosting.spotsLeft <= Math.max(5, Math.ceil(hosting.spots * 0.2));
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`h-2 overflow-hidden rounded-full ${tone === "dark" ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700"}`}
      >
        <div
          className={`h-full rounded-full ${hosting.spotsLeft === 0 ? "bg-slate-400" : urgent ? "bg-flag-500" : "bg-brand-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {label && (
        <p
          className={`text-xs font-bold uppercase tracking-[0.14em] ${
            tone === "dark"
              ? "text-white"
              : urgent && hosting.spotsLeft > 0
                ? "text-flag-700 dark:text-flag-300"
                : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {spotsMessage(hosting)}
        </p>
      )}
    </div>
  );
}

/**
 * An organised trip in a list, drawn like the posters these trips are
 * shared as: the photo, the price sticker, the dates and how many spots
 * are left.
 */
export function HostedTripCard({
  trip,
}: {
  trip: PublicTripSummary & { hosting: TripHosting };
}) {
  const h = trip.hosting;
  const cover = trip.coverImage ?? h.gallery[0] ?? null;
  const leaves = countdown(trip.startDate);
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-card ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <SafeImage
          src={cover ? resolveImageUrl(cover) : null}
          alt=""
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
          fallback={
            <div
              aria-hidden
              className="h-full w-full bg-gradient-to-br from-brand-700 via-brand-900 to-slate-950"
            />
          }
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent"
        />
        <div className="absolute right-3 top-3">
          <PriceSeal hosting={h} />
        </div>
        {leaves && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow">
            {leaves}
          </span>
        )}
        <div className="absolute inset-x-4 bottom-3">
          {h.tagline && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-300">
              {h.tagline}
            </p>
          )}
          <h3 className="mt-0.5 line-clamp-2 font-display text-xl font-black uppercase leading-tight tracking-tight">
            {trip.title}
          </h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
          <span className="flex items-center gap-1.5">
            <CalendarDaysIcon aria-hidden className="h-4 w-4 text-gold-300" />
            {dateRange(trip.startDate, trip.endDate)}
          </span>
          {trip.destination && (
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPinIcon
                aria-hidden
                className="h-4 w-4 shrink-0 text-gold-300"
              />
              <span className="truncate">
                {trip.destination.name}, {trip.destination.county.name}
              </span>
            </span>
          )}
        </div>
        {h.includes.length > 0 && (
          <p className="line-clamp-1 text-xs text-white/60">
            Includes {h.includes.slice(0, 3).join(" · ")}
          </p>
        )}
        <div className="mt-auto">
          <SpotsMeter hosting={h} tone="dark" />
        </div>
      </div>
    </Link>
  );
}
