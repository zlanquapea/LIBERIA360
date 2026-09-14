"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { FeaturedDestinationCard } from "./FeaturedDestinationCard";
import type { Place, VerificationStatus } from "@/lib/types";

// Product feedback: "all of the sponsor ad[s] in the application... should
// be a carousel of sliding cards... user should be able to slide the card
// left and right." Home's paid featured-placement section (see
// FeaturedDestinationCard's own doc comment — this is exactly the
// "sponsor ad" surface) was a plain wrapping grid, so on any page wider
// than one row there was nothing to slide at all.
//
// This reuses EventCarousel's exact snap-scroll mechanism rather than
// inventing a new one: a native `snap-x snap-mandatory` scroll container
// gets touch/trackpad/mouse-wheel swiping, momentum, and rubber-banding
// for free from the browser — no drag-physics JS to get subtly wrong, no
// risk of fighting the page's own vertical scroll (the "barriers" a
// hand-rolled drag-to-slide implementation tends to introduce). Arrow
// buttons and dots are convenience affordances layered on top via
// `scrollIntoView`, not the primary interaction.
export function FeaturedPlacementsCarousel({
  placements,
}: {
  placements: Array<{
    id: string;
    place: Place;
    verificationStatus?: VerificationStatus;
  }>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || placements.length === 0) return;

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
  }, [placements.length]);

  if (placements.length === 0) return null;

  function scrollToIndex(index: number) {
    const count = placements.length;
    const target = ((index % count) + count) % count;
    cardEls.current[target]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
    }
  }

  return (
    <div>
      <div className="relative">
        <div
          ref={trackRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured places"
          tabIndex={placements.length > 1 ? 0 : -1}
          onKeyDown={handleKeyDown}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {placements.map((placement, i) => (
            <div
              key={placement.id}
              ref={(el) => {
                cardEls.current[i] = el;
              }}
              className="w-72 shrink-0 snap-start sm:w-80"
            >
              <FeaturedDestinationCard
                place={placement.place}
                verificationStatus={placement.verificationStatus}
              />
            </div>
          ))}
        </div>

        {placements.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              aria-label="Previous featured place"
              className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronLeftIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              aria-label="Next featured place"
              className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronRightIcon aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {placements.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {placements.map((placement, i) => (
            <button
              key={placement.id}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to featured place ${i + 1}`}
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
    </div>
  );
}
