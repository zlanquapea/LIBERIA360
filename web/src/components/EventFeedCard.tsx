"use client";

import Link from "next/link";
import { CalendarDaysIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { resolveImageUrl } from "@/lib/images";
import { gradientForCategory } from "@/lib/category-colors";
import { formatEventDateRange } from "@/lib/format";
import { SafeImage } from "./SafeImage";
import { EventRsvpButtons } from "./EventRsvpButtons";
import { ShareMenu } from "./ShareMenu";
import type { Event } from "@/lib/types";

// The Events listing, rebuilt as a Facebook-style feed of full cards
// (image, date, title, location, an "X interested · Y going" summary, and
// an RSVP/Share action row) in place of the previous compact list row —
// adapted to this app's own data (a real interestedCount/goingCount pair
// backed by EventsService.setRsvp, this app's own ShareMenu) rather than
// copying Facebook's exact chrome.
export function EventFeedCard({ event }: { event: Event }) {
  const cover = event.images[0] ? resolveImageUrl(event.images[0]) : null;
  const locationLabel = event.place?.name ?? event.locationText ?? event.county.name;
  const hasStats = event.interestedCount > 0 || event.goingCount > 0;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Link href={`/events/${event.id}`} className="block">
        <div className="relative aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800">
          <SafeImage
            src={cover}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <div
                aria-hidden
                className="flex h-full w-full items-center justify-center"
                style={{ backgroundImage: gradientForCategory(event.category) }}
              >
                <CalendarDaysIcon aria-hidden className="h-12 w-12 text-white/70" />
              </div>
            }
          />
        </div>

        <div className="px-4 pt-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {formatEventDateRange(event.startDate, event.endDate)}
          </p>
          <h3 className="mt-0.5 line-clamp-2 font-display text-lg font-bold text-slate-950 dark:text-white">
            {event.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <MapPinIcon aria-hidden className="h-4 w-4 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </p>
        </div>
      </Link>

      <div className="px-4 pb-4 pt-2">
        {hasStats && (
          <p className="pb-2 text-sm text-slate-500 dark:text-slate-400">
            {event.interestedCount > 0 && `${event.interestedCount} interested`}
            {event.interestedCount > 0 && event.goingCount > 0 && " · "}
            {event.goingCount > 0 && `${event.goingCount} going`}
          </p>
        )}
        <div className="grid grid-cols-2 gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
          <EventRsvpButtons
            eventId={event.id}
            initialStatus={null}
            initialInterestedCount={event.interestedCount}
            initialGoingCount={event.goingCount}
            variant="feed"
          />
          <ShareMenu placeName={event.name} contentType="event" variant="feed" />
        </div>
      </div>
    </article>
  );
}
