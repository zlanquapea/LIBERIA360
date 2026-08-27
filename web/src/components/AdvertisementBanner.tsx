"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import { MegaphoneIcon } from "@heroicons/react/24/outline";
import { AdvertisementCard } from "./AdvertisementCard";
import type { Advertisement } from "@/lib/types";

// Strategic placement wrapper — a snap-scrolling carousel of full-bleed ad
// slides (see AdvertisementCard), same shelf pattern as "Featured this
// week" on this page, rather than a vertical stack of full-width banners:
// with many advertisers running at once, a stack would make the page
// increasingly long, while a carousel scales to any number of ads without
// growing the page. Dropped between organic content sections rather than
// above the fold, so it reads as a supplement to discovery rather than
// competing with it.
//
// `snap-x snap-mandatory` on the track makes a drag/swipe settle on
// exactly one slide instead of stopping at an arbitrary scroll offset —
// what makes a horizontally-scrollable div actually feel like a carousel
// rather than a viewport onto a long strip. The arrow buttons and dot
// indicators are the same affordance for anyone not dragging (desktop
// mouse users, screen-reader/keyboard users tabbing to a button instead of
// a swipe gesture); both just point-and-click through the same scroll
// container rather than keeping separate "which slide is showing" state,
// so the two navigation methods can never disagree.
//
// Each card is dismissible for the current page view only — NOT persisted
// across reloads/visits (previously written to localStorage, so a single
// dismiss hid an ad from that visitor forever). Advertisers are paying for
// impressions, and a dismissal permanently suppressing future ones for
// that visitor undercuts what they're paying for; a dismiss here just
// declutters the current view, and the ad is back the next time they load
// the page. Renders nothing once every ad on this load has either never
// existed or been dismissed (no empty "Sponsored" shelf).
export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);

  function dismiss(id: string) {
    setDismissed((prev) => [...prev, id]);
  }

  const visible = ads.filter((ad) => !dismissed.includes(ad.id));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  // Tracks which slide is currently centered in the scroll container so
  // the dot indicator stays in sync whether the visitor got there by
  // dragging, an arrow click, or a dot click — all three just move the
  // same scrollLeft, this just reads it back.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || visible.length === 0) return;

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
  }, [visible.length]);

  function scrollToIndex(index: number) {
    const count = visible.length;
    const target = ((index % count) + count) % count;
    cardEls.current[target]?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
  }

  useEffect(() => {
    if (visible.length <= 1 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const target =
        (((activeIndex + 1) % visible.length) + visible.length) %
        visible.length;
      cardEls.current[target]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [visible.length, activeIndex, paused, reducedMotion]);

  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby="sponsored-heading"
      aria-label="Sponsored advertisements"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="sponsored-heading"
          className="flex items-center gap-1.5 font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
        >
          <MegaphoneIcon
            aria-hidden
            className="h-5 w-5 text-slate-400 dark:text-slate-500"
          />
          Sponsored
        </h2>
        {visible.length > 1 && (
          <button
            type="button"
            onClick={() => setPaused((value) => !value)}
            aria-label={
              paused
                ? "Resume sponsored advertisements"
                : "Pause sponsored advertisements"
            }
            aria-pressed={paused}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {paused ? (
              <PlayIcon aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <PauseIcon aria-hidden className="h-3.5 w-3.5" />
            )}
            {paused ? "Play" : "Pause"}
          </button>
        )}
      </div>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setPaused(false);
        }}
      >
        <div
          ref={trackRef}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {visible.map((ad, i) => (
            <AdvertisementCard
              key={ad.id}
              ad={ad}
              onDismiss={() => dismiss(ad.id)}
              cardRef={(el) => {
                cardEls.current[i] = el;
              }}
            />
          ))}
        </div>

        {visible.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              aria-label="Previous ad"
              className="absolute left-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronLeftIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              aria-label="Next ad"
              className="absolute right-1 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronRightIcon aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {visible.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {visible.map((ad, i) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to ad ${i + 1}`}
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
