"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

const TRIGGER = 64;
const reloadPage = () => window.location.reload();
const fields = 'input, textarea, select, [contenteditable="true"]';

function canStartPull(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  // Safari reports negative offsets while rubber-banding at the top.
  if (window.scrollY > 1 || document.documentElement.scrollTop > 1)
    return false;
  if (
    target.closest(
      'input, textarea, select, button, video, audio, [contenteditable="true"], [role="dialog"], [role="slider"], .leaflet-container, [data-no-pull-refresh]',
    )
  )
    return false;
  if (document.activeElement?.matches(fields)) return false;
  for (
    let element: Element | null = target;
    element;
    element = element.parentElement
  ) {
    if (element.scrollTop > 1) return false;
  }
  return !window.visualViewport || window.visualViewport.scale === 1;
}

export function PullToRefresh({
  onRefresh = reloadPage,
}: {
  onRefresh?: () => void;
}) {
  const pathname = usePathname();
  const [distance, setDistance] = useState(0);
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let origin: {
      x: number;
      y: number;
      id: number;
      target: EventTarget | null;
    } | null = null;
    let pulled = 0;
    let locked = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setDistance(0);
    setMessage("");
    setRefreshing(false);
    const reset = () => {
      origin = null;
      pulled = 0;
      setDistance(0);
    };
    const input = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.matches(
          'input:not([type="search"]), textarea, select, [contenteditable="true"]',
        )
      )
        dirty = true;
    };
    const begin = (event: TouchEvent) => {
      reset();
      if (locked || event.touches.length !== 1 || !canStartPull(event.target))
        return;
      const touch = event.touches[0];
      origin = {
        x: touch.clientX,
        y: touch.clientY,
        id: touch.identifier,
        target: event.target,
      };
    };
    const move = (event: TouchEvent) => {
      if (!origin) return;
      const touch = event.touches[0];
      if (
        event.touches.length !== 1 ||
        touch.identifier !== origin.id ||
        !canStartPull(origin.target)
      ) {
        reset();
        return;
      }
      const dx = touch.clientX - origin.x;
      const dy = touch.clientY - origin.y;
      // Allow natural sideways drift; cancel only a predominantly horizontal swipe.
      if (dy < 0 || Math.abs(dx) > Math.max(12, dy)) {
        reset();
        return;
      }
      if (dy < 8) return;
      if (!event.cancelable) {
        reset();
        return;
      }
      event.preventDefault();
      pulled = Math.min(100, dy * 0.6);
      setMessage("");
      setDistance(pulled);
    };
    const end = (event: TouchEvent) => {
      if (
        !origin ||
        !Array.from(event.changedTouches).some(
          (touch) => touch.identifier === origin?.id,
        )
      )
        return;
      const ready = pulled >= TRIGGER;
      reset();
      if (!ready || locked) return;
      if (!navigator.onLine) {
        setMessage("You’re offline. Connect to refresh.");
        clearTimeout(timer);
        timer = setTimeout(() => setMessage(""), 4000);
        return;
      }
      if (
        dirty &&
        !window.confirm(
          "Refresh this page? Unsaved changes or message drafts may be lost.",
        )
      )
        return;
      locked = true;
      setRefreshing(true);
      timer = setTimeout(onRefresh, 150);
    };
    // Own overscroll consistently in browsers and installed apps, without
    // depending on iOS standalone detection or competing native refresh.
    const elements = [document.documentElement, document.body];
    const previous = elements.map(
      (element) => element.style.overscrollBehaviorY,
    );
    elements.forEach((element) => {
      element.style.overscrollBehaviorY = "none";
    });
    document.addEventListener("input", input, true);
    document.addEventListener("change", input, true);
    document.addEventListener("touchstart", begin, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", move, {
      capture: true,
      passive: false,
    });
    document.addEventListener("touchend", end, true);
    document.addEventListener("touchcancel", reset, true);
    return () => {
      clearTimeout(timer);
      elements.forEach((element, index) => {
        element.style.overscrollBehaviorY = previous[index];
      });
      document.removeEventListener("input", input, true);
      document.removeEventListener("change", input, true);
      document.removeEventListener("touchstart", begin, true);
      document.removeEventListener("touchmove", move, true);
      document.removeEventListener("touchend", end, true);
      document.removeEventListener("touchcancel", reset, true);
    };
  }, [pathname, onRefresh]);

  const visible = distance > 0 || refreshing || Boolean(message);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-none fixed inset-x-0 z-[200] flex justify-center px-4 ${visible ? "" : "hidden"}`}
      style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-brand-800 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300">
        <ArrowPathIcon
          aria-hidden
          className={`h-5 w-5 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
          style={
            refreshing ? undefined : { transform: `rotate(${distance * 3}deg)` }
          }
        />
        {message ||
          (refreshing
            ? "Refreshing…"
            : distance >= TRIGGER
              ? "Release to refresh"
              : "Pull down to refresh")}
      </div>
    </div>
  );
}
