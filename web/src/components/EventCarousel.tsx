"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { CalendarDaysIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { EventCard } from "./EventCard";
import type { Event } from "@/lib/types";

// Strategic placement fix — events previously surfaced only as a plain
// text list at the very bottom of Home (below the ad carousel and the
// Trip Planner/Creators pairing), and only once approved, so with few
// approved events at any given time the section usually rendered nothing
// at all. This reuses AdvertisementBanner's exact snap-scroll carousel
// mechanism (see its doc comment for the snap-x/scroll-position/dot-sync
// mechanics — copied here rather than shared, since the dismiss-state
// half of that component doesn't apply to organic content) and moves the
// section up to sit right after Trending Places: a co-equal discovery
// surface instead of a footnote, with a real "See all" link since /events
// (unlike ads) has a full listing page to send people to.
export function EventCarousel({
  events,
  title = "Happening soon",
  seeAllHref = "/events",
}: {
  events: Event[];
  // Lets the same carousel serve as the Events listing's own "Featured
  // events" shelf (see events/page.tsx) without a redundant "See all"
  // link back to the page it's already sitting on.
  title?: string;
  seeAllHref?: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || events.length === 0) return;

    let raf = 0;
    function updateActive() {
      const trackEl = trackRef.current;
      if (!trackEl) return;
      const center = trackEl.scrollLeft + trackEl.clientWidth / 2;
      let closest = 0;
      let closestDistance = Infinity;
      cardEls.current.forEach((el, i) => {
        if (!el) return;
        const distance = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = i;
        }
      });
      setActiveIndex(closest);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateActive);
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    updateActive();
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [events.length]);

  if (events.length === 0) {
    return (
      <section
        aria-labelledby="events-carousel-heading"
        className="flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h2
            id="events-carousel-heading"
            className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            <CalendarDaysIcon
              aria-hidden
              className="h-5 w-5 text-accent-600 dark:text-accent-400"
            />
            {title}
          </h2>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
            >
              See all
              <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            No upcoming events listed yet.
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Check back soon for real events across Liberia.
          </p>
        </div>
      </section>
    );
  }

  function scrollToIndex(index: number) {
    const count = events.length;
    const target = ((index % count) + count) % count;
    cardEls.current[target]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }

  return (
    <section
      aria-labelledby="events-carousel-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <h2
          id="events-carousel-heading"
          className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          <CalendarDaysIcon
            aria-hidden
            className="h-5 w-5 text-accent-600 dark:text-accent-400"
          />
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
          >
            See all
            <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {events.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              cardRef={(el) => {
                cardEls.current[i] = el;
              }}
            />
          ))}
        </div>

        {events.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              aria-label="Previous event"
              className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronLeftIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              aria-label="Next event"
              className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronRightIcon aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {events.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {events.map((event, i) => (
            <button
              key={event.id}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to event ${i + 1}`}
              aria-current={i === activeIndex}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex
                  ? "w-5 bg-brand-700 dark:bg-brand-400"
                  : "w-1.5 bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
