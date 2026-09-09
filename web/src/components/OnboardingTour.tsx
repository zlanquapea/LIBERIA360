"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ArrowRightIcon,
  MapIcon,
  SparklesIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { SPLASH_DISPLAY_MS, SPLASH_SESSION_KEY } from "./SplashScreen";

const ONBOARDING_STORAGE_KEY = "liberia360:onboarding-seen";

// Icons match the destinations these steps point at (MapIcon is Explore's
// own icon in lib/site-nav.ts, BookmarkIcon is Saved's) so a visitor who
// remembers this tour gets a small head start recognizing them again in
// the nav — SparklesIcon for the trip planner is the one exception, since
// that page doesn't have a single fixed icon of its own to match.
//
// `image` is a hand-picked, licensed photo bundled under public/onboarding
// (see the component doc comment below for why these replaced the earlier
// live-catalog-photo fetch) — one per step, chosen to match its theme.
const STEPS = [
  {
    icon: MapIcon,
    title: "Discover all of Liberia",
    description:
      "Browse trusted destinations, restaurants, hotels, and local businesses across every county — not just Monrovia.",
    image: "/onboarding/discover.jpg",
  },
  {
    icon: SparklesIcon,
    title: "Plan a trip in minutes",
    description:
      "Tell the trip planner what you're into and it builds a day-by-day itinerary for you — no account needed to start.",
    image: "/onboarding/plan-trip.jpg",
  },
  {
    icon: BookmarkIcon,
    title: "Save places for later",
    description:
      "Bookmark anything you like and find it again from Saved — it works even without a connection.",
    image: "/onboarding/save-places.jpg",
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
// behind an onboarding step would look exactly as fake as it is. The
// first attempt at this reused the homepage hero's fix (HeroPhotoMosaic):
// pull a handful of genuine catalog photos at random and let each step's
// own photo carry the visual weight. In practice that read poorly —
// whichever places happened to be freshly featured (a lodge's exterior, a
// restaurant interior) rarely matched a step's own theme, and a catalog
// with too few photographed places fell back to a plain icon anyway.
// Product asked for three specific, hand-picked photos instead — real
// Liberia photos it supplied, one per step, matched to that step's theme
// (see STEPS' `image` above) — bundled as static assets under
// public/onboarding rather than fetched, since these never change and
// never depend on what's currently in the catalog.
export function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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
    // Desktop pass (Sep 9, 2026): below `sm` this fills the viewport
    // exactly as before — full-bleed photo, full-width button, no visible
    // seam between this wrapper and the dialog inside it. At `sm` and up,
    // this wrapper instead centers a phone-shaped card (fixed width, tall,
    // rounded) against a dimmed backdrop — the fix for "it expands so much
    // on desktop and the button gets so long": rather than trying to make
    // one full-bleed mobile layout also read well stretched to a 1440px+
    // window, the mobile design *becomes the card*, at the width it was
    // actually designed at, same treatment CreatorStories' story viewer
    // already uses for the same reason.
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-white dark:bg-slate-950 sm:bg-slate-950/70 sm:p-6 sm:backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to LIBERIA360"
        className="relative flex h-full w-full flex-col overflow-hidden bg-white dark:bg-slate-950 sm:h-[min(90vh,48rem)] sm:w-[26rem] sm:rounded-[2.5rem] sm:shadow-2xl sm:ring-1 sm:ring-black/10 dark:sm:ring-white/10"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/25 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
                  className="relative flex w-full shrink-0 snap-center flex-col overflow-hidden"
                >
                  <Image
                    src={step.image}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 26rem, 100vw"
                    priority={i === 0}
                    className="object-cover"
                  />
                  {/* Bottom-anchored scrim so the title/description stay
                      legible over the photo, same purpose as the dark
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
              // Modernization pass (Sep 9, 2026): a flat hover:bg-* swap
              // reads exactly like every other button in the app — this is
              // the one button a first-time visitor is guaranteed to
              // press, so it gets its own small signature instead: a lift
              // off the surface with a matching brand-tinted shadow (not
              // a generic gray one, so it still reads as *this app's*
              // shadow rather than a default Bootstrap-y card lift), and
              // an arrow that unfurls from nothing beside the label rather
              // than sitting there static — the label nudges left half a
              // pixel to make room for it, so the whole thing reads as one
              // button reaching toward you rather than two elements
              // moving independently. All transform/opacity, no layout
              // thrash, and it fully reverses on active: (press) so a tap
              // on a touch device — which never sees :hover at all — still
              // gets the plain color-swap it always had.
              className="group/cta flex min-h-14 w-full items-center justify-center gap-1.5 rounded-2xl bg-brand-700 px-4 text-base font-semibold text-white shadow-md transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-brand-800 hover:shadow-xl hover:shadow-brand-900/30 active:translate-y-0 active:bg-brand-800 active:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
            >
              <span className="transition-transform duration-300 ease-out group-hover/cta:-translate-x-0.5">
                {isLast ? "Get started" : "Next"}
              </span>
              <span className="inline-flex w-0 items-center overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover/cta:w-5 group-hover/cta:opacity-100">
                <ArrowRightIcon aria-hidden className="h-5 w-5 shrink-0" />
              </span>
            </button>
          </div>
        </div>
      </div>,
    document.body,
  );
}
