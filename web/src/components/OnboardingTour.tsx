"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapIcon, SparklesIcon, BookmarkIcon } from "@heroicons/react/24/outline";
import { SPLASH_DISPLAY_MS, SPLASH_SESSION_KEY } from "./SplashScreen";
import { SafeImage } from "./SafeImage";
import { gradientForCategory } from "@/lib/category-colors";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import type { Place } from "@/lib/types";

const ONBOARDING_STORAGE_KEY = "liberia360:onboarding-seen";

// Icons match the destinations these steps point at (MapIcon is Explore's
// own icon in lib/site-nav.ts, BookmarkIcon is Saved's) so a visitor who
// remembers this tour gets a small head start recognizing them again in
// the nav — SparklesIcon for the trip planner is the one exception, since
// that page doesn't have a single fixed icon of its own to match. Doubles
// as each step's fallback badge when no real photo is available (see
// showcasePlaces below).
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
//
// Visual pass (Sep 6, 2026): "show the beauty of Liberia, not just text."
// This app has a deliberate no-*stock*-photography rule (see the
// layout-pass note atop app/page.tsx) — a generic tourism stock photo
// behind an onboarding step would look exactly as fake as it is. The fix
// used there for the homepage hero (HeroPhotoMosaic) is the same fix
// here: pull a handful of genuine catalog photos — real places already
// listed on the platform — and let each step's own photo carry the
// visual weight instead of a plain icon-in-a-circle. Fetched once, lazily,
// only at the moment the tour is actually about to open (never on a page
// load that won't show it), and each step falls back to its icon badge on
// the same colored-gradient treatment as PlaceCard/HeroPhotoMosaic if the
// catalog doesn't have enough photographed places yet — never a fake
// photo standing in for a real one.
export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showcasePlaces, setShowcasePlaces] = useState<(Place | null)[]>([
    null,
    null,
    null,
  ]);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideEls = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    // CI regression (Sep 6, 2026): this full-screen dialog is a real,
    // clickable modal — unlike SplashScreen, it can't just set itself
    // `pointer-events: none` to stay harmless everywhere, since Skip/
    // Next/swipe all need genuine pointer events to work for a real
    // visitor. A fresh Playwright browser context has no localStorage
    // entry for it either, so on any e2e spec slow enough to still be on
    // a page past the delay below, this popped up and ate every
    // subsequent click in six unrelated specs (auth, review, booking,
    // browse-search, admin-moderation). `navigator.webdriver` is the
    // standard signal for "this is an automated browser" — Playwright's
    // Chromium sets it by default — and no real visitor is ever affected
    // by skipping a first-run tour for one.
    if (navigator.webdriver) return;

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

    // Best-effort, never blocks opening the tour — a slow/failed fetch
    // just means every step falls back to its icon badge instead of a
    // photo (see the component doc comment above). featured-first (the
    // API's own default sort) so this leans toward the catalog's best
    // photographed places rather than whatever happens to be newest.
    fetch("/api/v1/places?limit=8")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data?: Place[] } | null) => {
        const withPhotos = (body?.data ?? []).filter(
          (place) => place.images.length > 0,
        );
        if (withPhotos.length === 0) return;
        setShowcasePlaces([
          withPhotos[0] ?? null,
          withPhotos[1] ?? null,
          withPhotos[2] ?? null,
        ]);
      })
      .catch(() => {
        // Fallback icon badges cover this — nothing else to do.
      });

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
        className="absolute right-3 top-3 z-10 rounded-full bg-black/25 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Skip
      </button>

      <div
        ref={trackRef}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const place = showcasePlaces[i];
          const cover = place?.images[0] ? resolveImageUrl(place.images[0]) : null;
          const coverThumb = place?.images[0]
            ? resolveThumbUrl(place.images[0])
            : null;

          return (
            <div
              key={step.title}
              ref={(el) => {
                slideEls.current[i] = el;
              }}
              className="relative flex w-full shrink-0 snap-center flex-col overflow-hidden"
            >
              {cover ? (
                <>
                  <SafeImage
                    src={cover}
                    thumbSrc={coverThumb}
                    alt=""
                    loading={i === 0 ? "eager" : "lazy"}
                    className="absolute inset-0 h-full w-full object-cover"
                    fallback={
                      <div
                        aria-hidden
                        className="absolute inset-0"
                        style={{ backgroundImage: gradientForCategory(place!.category.slug) }}
                      />
                    }
                  />
                  {/* Bottom-anchored scrim so the title/description stay
                      legible over any photo, same purpose as the dark
                      gradient under the homepage hero's own imagery. */}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
                  />
                  <div className="relative mt-auto flex flex-col gap-3 px-8 pb-40 pt-16 text-center sm:pb-44">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur-sm">
                      <Icon aria-hidden className="h-7 w-7" />
                    </span>
                    <div className="mx-auto max-w-sm">
                      <h2 className="font-display text-2xl font-bold text-white">
                        {step.title}
                      </h2>
                      <p className="mt-3 leading-6 text-white/85">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 pb-40 pt-16 text-center sm:pb-44">
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
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 bg-white px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 dark:bg-slate-950">
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
