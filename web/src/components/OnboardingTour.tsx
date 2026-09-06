"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapIcon, SparklesIcon, BookmarkIcon } from "@heroicons/react/24/outline";
import { SPLASH_DISPLAY_MS, SPLASH_SESSION_KEY } from "./SplashScreen";

const ONBOARDING_STORAGE_KEY = "liberia360:onboarding-seen";

// Icons match the destinations these steps point at (MapIcon is Explore's
// own icon in lib/site-nav.ts, BookmarkIcon is Saved's) so a visitor who
// remembers this tour gets a small head start recognizing them again in
// the nav — SparklesIcon for the trip planner is the one exception, since
// that page doesn't have a single fixed icon of its own to match.
const STEPS = [
  {
    icon: MapIcon,
    title: "Discover all of Liberia",
    description:
      "Browse trusted destinations, restaurants, hotels, and local businesses across every county — not just Monrovia.",
  },
  {
    icon: SparklesIcon,
    title: "Plan a trip in minutes",
    description:
      "Tell the trip planner what you're into and it builds a day-by-day itinerary for you — no account needed to start.",
  },
  {
    icon: BookmarkIcon,
    title: "Save places for later",
    description:
      "Bookmark anything you like and find it again from Saved — it works even without a connection.",
  },
] as const;

// Product ask (Sep 6, 2026): a first-time-visitor feature tour, shown
// once ever (localStorage, unlike SplashScreen's per-session gate) after
// the splash screen's own moment has had its window, so the two
// full-screen introductions don't stack on top of each other. Swipeable
// via native horizontal scroll-snap — same mechanism as EventCarousel/
// AdvertisementBanner (see EventCarousel's doc comment) — rather than a
// hand-rolled touch-drag handler, plus Next/Skip buttons for anyone who
// isn't swiping.
export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideEls = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
    } catch {
      // Storage-disabled contexts (private browsing, some in-app
      // browsers): never show it rather than risk it reappearing on
      // every single visit with no way to remember it was dismissed.
      return;
    }
    if (seen) return;

    // Splash already ran this session (a later page load, same tab) →
    // show immediately. Otherwise splash is about to run for the first
    // time → wait out its display window first.
    let splashAlreadyShown = false;
    try {
      splashAlreadyShown =
        window.sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
    } catch {
      // Falls through to the delayed timer — the safer default.
    }
    const delay = splashAlreadyShown ? 0 : SPLASH_DISPLAY_MS + 150;
    const timer = window.setTimeout(() => setOpen(true), delay);
    return () => window.clearTimeout(timer);
  }, []);

  // Same lock-scroll + Escape-to-close pattern as the app's other
  // full-screen overlays (MobileMenu, CreatorPostViewer).
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Same scroll-position → active-dot sync as EventCarousel.
  useEffect(() => {
    const track = trackRef.current;
    if (!open || !track) return;
    let raf = 0;
    function updateActive() {
      const trackEl = trackRef.current;
      if (!trackEl) return;
      const center = trackEl.scrollLeft + trackEl.clientWidth / 2;
      let closest = 0;
      let closestDistance = Infinity;
      slideEls.current.forEach((el, i) => {
        if (!el) return;
        const distance = Math.abs(
          el.offsetLeft + el.offsetWidth / 2 - center,
        );
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
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // Nothing else to do — worst case it shows again next visit.
    }
  }

  function goTo(index: number) {
    const target = Math.max(0, Math.min(STEPS.length - 1, index));
    // Set the active dot/button state immediately rather than waiting on
    // the scroll listener above to catch up once the smooth-scroll
    // animation settles — otherwise clicking Next/a dot leaves the UI
    // showing the old step for the length of that animation.
    setActiveIndex(target);
    slideEls.current[target]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }

  if (!open || typeof document === "undefined") return null;

  const isLast = activeIndex === STEPS.length - 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to LIBERIA360"
      className="fixed inset-0 z-[125] flex flex-col bg-white dark:bg-slate-950"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 z-10 rounded-full px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:text-slate-100"
      >
        Skip
      </button>

      <div
        ref={trackRef}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              ref={(el) => {
                slideEls.current[i] = el;
              }}
              className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-6 px-8 pt-16 text-center"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                <Icon aria-hidden className="h-10 w-10" />
              </span>
              <div className="max-w-sm">
                <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">
                  {step.title}
                </h2>
                <p className="mt-3 leading-6 text-slate-600 dark:text-slate-300">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((step, i) => (
            <button
              key={step.title}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === activeIndex}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex
                  ? "w-5 bg-brand-700 dark:bg-brand-400"
                  : "w-1.5 bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (isLast ? dismiss() : goTo(activeIndex + 1))}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-brand-700 px-4 text-base font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
        >
          {isLast ? "Get started" : "Next"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
