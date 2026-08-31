"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MegaphoneIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";
import { whatsappLink } from "@/lib/contact";
import { AdvertisementCard } from "./AdvertisementCard";
import type { Ad, Advertisement, AdCtaType } from "@/lib/types";

const AUTOPLAY_DELAY_MS = 5000;
const RESUME_DELAY_MS = 5000;
const TRANSITION_DURATION_MS = 360;
const SWIPE_THRESHOLD_PX = 42;

function toHomepageAd(ad: Advertisement): Ad {
  let ctaType: AdCtaType = "learn_more";
  let ctaUrl = `/ads/${ad.id}`;

  if (ad.contactWhatsapp) {
    ctaType = "message";
    ctaUrl = whatsappLink(ad.contactWhatsapp);
  } else if (ad.contactPhone) {
    ctaType = "call";
    ctaUrl = `tel:${ad.contactPhone}`;
  } else if (ad.externalLink) {
    ctaType = /apply|career|hiring|job/i.test(`${ad.title} ${ad.description}`)
      ? "apply"
      : "learn_more";
    ctaUrl = ad.externalLink;
  }

  return {
    id: ad.id,
    sponsorLabel: "Sponsored",
    image: ad.images[0] ?? null,
    title: ad.title,
    description: ad.description,
    ctaType,
    ctaUrl,
    advertiserName: ad.owner?.name ?? undefined,
  };
}

export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  const mappedAds = useMemo(() => ads.map(toHomepageAd), [ads]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [slideStep, setSlideStep] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const visible = useMemo(
    () => mappedAds.filter((ad) => !dismissed.includes(ad.id)),
    [dismissed, mappedAds],
  );

  const measureSlide = useCallback(() => {
    const track = trackRef.current;
    const firstSlide = track?.firstElementChild as HTMLElement | null;
    if (!track || !firstSlide) return;
    const styles = window.getComputedStyle(track);
    const gap = parseFloat(styles.columnGap || styles.gap || "0");
    setSlideStep(firstSlide.getBoundingClientRect().width + gap);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    const updateVisibility = () =>
      setTabVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useLayoutEffect(() => {
    measureSlide();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measureSlide);
    if (trackRef.current && observer) observer.observe(trackRef.current);
    window.addEventListener("resize", measureSlide);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measureSlide);
    };
  }, [measureSlide, visible.length]);

  useEffect(() => {
    setActiveIndex((current) =>
      Math.min(current, Math.max(0, visible.length - 1)),
    );
  }, [visible.length]);

  useEffect(
    () => () => {
      if (resumeTimerRef.current !== null)
        window.clearTimeout(resumeTimerRef.current);
    },
    [],
  );

  const scheduleResume = useCallback(() => {
    if (resumeTimerRef.current !== null)
      window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      if (document.visibilityState === "visible") setPaused(false);
      resumeTimerRef.current = null;
    }, RESUME_DELAY_MS);
  }, []);

  const pauseForInteraction = useCallback(() => {
    setPaused(true);
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
  }, []);

  const restartAfterInteraction = useCallback(() => {
    pauseForInteraction();
    scheduleResume();
  }, [pauseForInteraction, scheduleResume]);

  const goTo = useCallback(
    (nextIndex: number, manual = true) => {
      if (visible.length <= 1) return;
      const normalized =
        ((nextIndex % visible.length) + visible.length) % visible.length;
      setActiveIndex(normalized);
      if (manual) restartAfterInteraction();
    },
    [restartAfterInteraction, visible.length],
  );

  useEffect(() => {
    if (visible.length <= 1 || paused || reducedMotion || !tabVisible) return;
    const timer = window.setTimeout(
      () => goTo(activeIndex + 1, false),
      AUTOPLAY_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [activeIndex, goTo, paused, reducedMotion, tabVisible, visible.length]);

  function dismiss(id: string) {
    setDismissed((current) => [...current, id]);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    pauseForInteraction();
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (
      Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
      Math.abs(deltaX) > Math.abs(deltaY)
    ) {
      goTo(activeIndex + (deltaX < 0 ? 1 : -1));
    } else {
      scheduleResume();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(visible.length - 1);
    }
  }

  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby="sponsored-heading"
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
            onClick={() => {
              setPaused((current) => !current);
              if (!paused) scheduleResume();
            }}
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
        className="relative overflow-hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label="Sponsored advertisements"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null;
          scheduleResume();
        }}
      >
        <div
          ref={trackRef}
          className="flex gap-4"
          style={{
            transform: slideStep
              ? `translate3d(${activeIndex === 0 ? 0 : -activeIndex * slideStep}px, 0, 0)`
              : undefined,
            transition: reducedMotion
              ? "none"
              : `transform ${TRANSITION_DURATION_MS}ms ease-in-out`,
            willChange: reducedMotion ? "auto" : "transform",
          }}
        >
          {visible.map((ad, index) => (
            <div
              key={ad.id}
              className="w-[calc(100%-2.5rem)] shrink-0 sm:w-[calc(100%-6rem)]"
              aria-hidden={index !== activeIndex}
              inert={index !== activeIndex ? true : undefined}
            >
              <AdvertisementCard ad={ad} onDismiss={() => dismiss(ad.id)} />
            </div>
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          Showing sponsored ad {activeIndex + 1} of {visible.length}:{" "}
          {visible[activeIndex]?.title}
        </span>

        {visible.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Previous sponsored ad"
              className="absolute left-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:flex dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronLeftIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next sponsored ad"
              className="absolute right-2 top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:flex dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronRightIcon aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {visible.length > 1 && (
        <div
          className="flex items-center justify-center gap-1.5"
          aria-label="Sponsored ad selection"
        >
          {visible.map((ad, index) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to sponsored ad ${index + 1}`}
              aria-current={index === activeIndex}
              className={`h-1.5 rounded-full transition-all duration-300 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                index === activeIndex
                  ? "w-6 bg-brand-700 dark:bg-brand-400"
                  : "w-1.5 bg-slate-300 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
