"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import { MegaphoneIcon } from "@heroicons/react/24/outline";
import { AdvertisementCard } from "./AdvertisementCard";
import type { Advertisement } from "@/lib/types";

const AUTOPLAY_DELAY_MS = 6000;
const TRANSITION_DURATION_MS = 260;
const REDUCED_TRANSITION_DURATION_MS = 60;
const SWIPE_THRESHOLD_PX = 42;

export function AdvertisementBanner({ ads }: { ads: Advertisement[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(ads[0]?.id ?? null);
  const [outgoingId, setOutgoingId] = useState<string | null>(null);
  const [incomingId, setIncomingId] = useState<string | null>(null);
  const [transitionStarted, setTransitionStarted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);
  const transitionFrameRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const visible = useMemo(
    () => ads.filter((ad) => !dismissed.includes(ad.id)),
    [ads, dismissed],
  );
  const activeAd =
    visible.find((ad) => ad.id === activeId) ?? visible[0] ?? null;
  const outgoingAd = visible.find((ad) => ad.id === outgoingId) ?? null;
  const incomingAd = visible.find((ad) => ad.id === incomingId) ?? null;
  const selectedId = incomingAd?.id ?? activeAd?.id ?? null;
  const activeIndex = Math.max(
    0,
    visible.findIndex((ad) => ad.id === selectedId),
  );
  const duration = reducedMotion
    ? REDUCED_TRANSITION_DURATION_MS
    : TRANSITION_DURATION_MS;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (activeAd || visible.length === 0) return;
    setActiveId(visible[0].id);
  }, [activeAd, visible]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null)
        window.clearTimeout(transitionTimerRef.current);
      if (transitionFrameRef.current !== null)
        window.cancelAnimationFrame(transitionFrameRef.current);
    },
    [],
  );

  const changeToIndex = useCallback(
    (index: number) => {
      if (transitioning || visible.length <= 1 || !activeAd) return;
      const targetIndex =
        ((index % visible.length) + visible.length) % visible.length;
      const target = visible[targetIndex];
      if (!target || target.id === activeAd.id) return;

      setOutgoingId(activeAd.id);
      setIncomingId(target.id);
      setTransitionStarted(false);
      setTransitioning(true);

      transitionFrameRef.current = window.requestAnimationFrame(() => {
        setTransitionStarted(true);
      });
      transitionTimerRef.current = window.setTimeout(() => {
        setActiveId(target.id);
        setOutgoingId(null);
        setIncomingId(null);
        setTransitionStarted(false);
        setTransitioning(false);
        transitionTimerRef.current = null;
        transitionFrameRef.current = null;
      }, duration);
    },
    [activeAd, duration, transitioning, visible],
  );

  function dismiss(id: string) {
    if (transitioning) return;
    const dismissedIndex = visible.findIndex((ad) => ad.id === id);
    const remaining = visible.filter((ad) => ad.id !== id);
    setDismissed((current) => [...current, id]);
    if (id === activeAd?.id) {
      setActiveId(
        remaining.length > 0
          ? remaining[Math.min(dismissedIndex, remaining.length - 1)].id
          : null,
      );
    }
  }

  useEffect(() => {
    if (visible.length <= 1 || paused || transitioning || !activeAd) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== "visible") return;
      changeToIndex(activeIndex + 1);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeAd, activeIndex, changeToIndex, paused, transitioning, visible.length]);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || transitioning) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) <= Math.abs(deltaY))
      return;
    changeToIndex(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
  }

  if (visible.length === 0 || !activeAd) return null;

  const currentLayerAd = outgoingAd ?? activeAd;

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
          data-testid="sponsored-crossfade-container"
          className="relative h-56 w-full touch-pan-y overflow-hidden rounded-2xl sm:h-64"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            data-transition-layer="current"
            aria-hidden={Boolean(incomingAd)}
            className={`absolute inset-0 z-10 ${incomingAd ? "pointer-events-none" : "pointer-events-auto"}`}
            style={{
              opacity: transitionStarted && incomingAd ? 0 : 1,
              transform: "translateZ(0)",
              transitionProperty: "opacity",
              transitionDuration: `${duration}ms`,
              transitionTimingFunction: "ease-in-out",
              willChange: "opacity",
            }}
          >
            <AdvertisementCard
              ad={currentLayerAd}
              onDismiss={() => dismiss(currentLayerAd.id)}
              fillContainer
              shimmerActive={!incomingAd}
            />
          </div>

          {incomingAd && (
            <div
              data-transition-layer="incoming"
              className="pointer-events-auto absolute inset-0 z-20"
              style={{
                opacity: transitionStarted ? 1 : 0,
                transform:
                  reducedMotion || transitionStarted
                    ? "translateZ(0) scale(1)"
                    : "translateZ(0) scale(0.985)",
                transitionProperty: reducedMotion
                  ? "opacity"
                  : "opacity, transform",
                transitionDuration: `${duration}ms`,
                transitionTimingFunction: "ease-in-out",
                willChange: "opacity, transform",
              }}
            >
              <AdvertisementCard
                ad={incomingAd}
                onDismiss={() => dismiss(incomingAd.id)}
                fillContainer
                shimmerActive
              />
            </div>
          )}
        </div>

        {visible.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => changeToIndex(activeIndex - 1)}
              disabled={transitioning}
              aria-label="Previous ad"
              className="absolute left-1 top-1/2 z-30 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60 sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronLeftIcon aria-hidden className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => changeToIndex(activeIndex + 1)}
              disabled={transitioning}
              aria-label="Next ad"
              className="absolute right-1 top-1/2 z-30 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur-sm transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60 sm:flex dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <ChevronRightIcon aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {visible.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {visible.map((ad, index) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => changeToIndex(index)}
              disabled={transitioning}
              aria-label={`Go to ad ${index + 1}`}
              aria-current={ad.id === selectedId}
              className={`h-1.5 rounded-full transition-all disabled:cursor-wait ${
                ad.id === selectedId
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
