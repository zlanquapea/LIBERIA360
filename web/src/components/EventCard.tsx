'use client';

import Link from 'next/link';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { resolveImageUrl } from '@/lib/images';
import { gradientForCategory } from '@/lib/category-colors';
import { formatEventCategory } from '@/lib/format';
import { SafeImage } from './SafeImage';
import type { Event } from '@/lib/types';

// One slide in the "Happening soon" carousel — same full-bleed
// image-plus-bottom-gradient treatment as AdvertisementCard (see
// EventCarousel's doc comment for why this reuses that exact carousel
// mechanism), but for organic content rather than a paid placement:
// no dismiss button, and a ticket-style date chip up top instead of a
// "Sponsored" pill, since the thing someone scanning this shelf actually
// needs first is "when" — not a disclosure label. `gradientForCategory`
// reuses the same deterministic per-category color system PlaceCard and
// the map pins use, seeded by the event's own category, rather than one
// flat placeholder gradient for every event with no photo yet.
export function EventCard({ event, cardRef }: { event: Event; cardRef?: (el: HTMLDivElement | null) => void }) {
  const cover = event.images[0] ? resolveImageUrl(event.images[0]) : null;
  const start = new Date(event.startDate);
  const month = start.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = start.getDate();
  const locationLabel = event.place?.name ?? event.locationText ?? event.county.name;

  return (
    <div
      ref={cardRef}
      className="group relative h-56 w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover sm:h-64 sm:w-96"
    >
      <Link href={`/events/${event.id}`} className="absolute inset-0 block">
        <SafeImage
          src={cover}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
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
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/40" />

        {/* Ticket-stub date chip — the one fact worth reading before
            anything else on a shelf of upcoming events. */}
        <div
          aria-hidden
          className="absolute left-3 top-3 z-10 flex w-12 flex-col items-center overflow-hidden rounded-lg bg-white shadow-md"
        >
          <span className="w-full bg-accent-600 py-0.5 text-center text-[10px] font-bold tracking-wide text-white">{month}</span>
          <span className="py-1 text-lg font-black leading-none text-slate-900">{day}</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4 text-white">
          <span className="w-fit rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm">
            {formatEventCategory(event.category)}
          </span>
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-tight">{event.name}</h3>
          <p className="truncate text-xs text-white/80">{locationLabel}</p>
          <span className="mt-0.5 text-xs font-semibold text-white/85 group-hover:text-white">View event →</span>
        </div>
      </Link>
    </div>
  );
}
