'use client';

import Link from 'next/link';
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl } from '@/lib/images';
import { gradientForCategory } from '@/lib/category-colors';
import { formatEventDateRange, isEventHappeningNow } from '@/lib/format';
import { SafeImage } from './SafeImage';
import { EventRsvpButtons } from './EventRsvpButtons';
import { ShareMenu } from './ShareMenu';
import type { Event } from '@/lib/types';

// One card in the "Happening soon"/"Featured events" carousels — same
// image-top, white-content-below composition as EventFeedCard (the
// Events listing's full-width feed card), just sized to sit in a
// horizontally-scrolling shelf instead of stacked full width, so the two
// don't feel like different features bolted on next to each other: a
// live "Happening now" badge (same emerald pill PlaceKeyFacts' "Open
// now" uses) beats a plain date for an event already in progress, then
// title, location, a "X going" count, and the same Interested/Share
// action row as the feed card.
export function EventCard({ event, cardRef }: { event: Event; cardRef?: (el: HTMLDivElement | null) => void }) {
  const cover = event.images[0] ? resolveImageUrl(event.images[0]) : null;
  const locationLabel = event.place?.name ?? event.locationText ?? event.county.name;
  const live = isEventHappeningNow(event.startDate, event.endDate);

  return (
    <div
      ref={cardRef}
      className="flex w-72 shrink-0 snap-center flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900 sm:w-80"
    >
      <Link href={`/events/${event.id}`} className="block">
        <div className="relative h-40 w-full bg-slate-100 dark:bg-slate-800 sm:h-44">
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
          {live ? (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              Happening now
            </span>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatEventDateRange(event.startDate, event.endDate)}
            </p>
          )}
          <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold text-slate-950 dark:text-white">
            {event.name}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
            <MapPinIcon aria-hidden className="h-4 w-4 shrink-0" />
            <span className="truncate">{locationLabel}</span>
          </p>
          {event.goingCount > 0 && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{event.goingCount} going</p>
          )}
        </div>
      </Link>

      <div className="mt-auto px-4 pb-4 pt-2">
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
    </div>
  );
}
