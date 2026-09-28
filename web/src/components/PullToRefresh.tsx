"use client";

import { useEffect, useRef, useState } from "react";

const PULL_TRIGGER_PX = 52;
const MAX_PULL_PX = 104;
const PULL_RESISTANCE = 0.75;
const AXIS_LOCK_PX = 8;
const RELOAD_DELAY_MS = 260;

type TouchOrigin = {
  identifier: number;
  x: number;
  y: number;
  target: EventTarget | null;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, input, select, textarea, summary, [contenteditable='true'], [role='button'], [data-no-pull-refresh]",
      ),
    )
  );
}

function hasScrollableParentAtOffset(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  let element: Element | null = target;
  while (element && element !== document.body) {
    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element);
      const scrollableY =
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        element.scrollHeight > element.clientHeight;
      if (scrollableY && element.scrollTop > 0) return true;
    }
    element = element.parentElement;
  }
  return false;
}

function canStartPull(target: EventTarget | null): boolean {
  if (document.body.classList.contains("messaging-chat")) return false;
  if (isInteractiveTarget(target)) return false;
  if (hasScrollableParentAtOffset(target)) return false;
  return window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
}

function getTrackedTouch(event: globalThis.TouchEvent, identifier: number) {
  return Array.from(event.touches).find((touch) => touch.identifier === identifier) ?? null;
}

function isStandaloneApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const originRef = useRef<TouchOrigin | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    function resetPull() {
      originRef.current = null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    function cancelPull() {
      cancelledRef.current = true;
      resetPull();
    }

    function handleTouchStart(event: globalThis.TouchEvent) {
      if (refreshingRef.current || !canStartPull(event.target)) return;
      const touch = event.touches[0];
      if (!touch) return;
      cancelledRef.current = false;
      originRef.current = {
        identifier: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        target: event.target,
      };
    }

    function handleTouchMove(event: globalThis.TouchEvent) {
      const origin = originRef.current;
      const touch = origin ? getTrackedTouch(event, origin.identifier) : null;
      if (!origin || !touch || refreshingRef.current || cancelledRef.current) return;

      if (
        window.scrollY > 0 ||
        document.documentElement.scrollTop > 0 ||
        hasScrollableParentAtOffset(origin.target)
      ) {
        cancelPull();
        return;
      }

      const deltaX = touch.clientX - origin.x;
      const deltaY = touch.clientY - origin.y;
      if (
        deltaY <= 0 ||
        Math.abs(deltaX) > Math.abs(deltaY) ||
        Math.abs(deltaX) > AXIS_LOCK_PX
      ) {
        cancelPull();
        return;
      }

      // Take ownership only after the finger is clearly moving vertically.
      // This preserves native horizontal swipes and prevents browser overscroll.
      if (deltaY < AXIS_LOCK_PX) return;
      // In regular Safari/Chrome, keep the browser-native pull-to-refresh
      // behavior (the spinner shown in Safari). Only prevent the browser
      // gesture inside a Home Screen standalone app where native refresh is
      // unavailable and our fallback owns the interaction.
      if (isStandaloneApp()) event.preventDefault();
      const nextDistance = Math.min(
        MAX_PULL_PX,
        Math.round(deltaY * PULL_RESISTANCE),
      );
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);
    }

    function handleTouchEnd(event: globalThis.TouchEvent) {
      const origin = originRef.current;
      if (!origin || cancelledRef.current) {
        resetPull();
        return;
      }
      const ended = Array.from(event.changedTouches).some(
        (touch) => touch.identifier === origin.identifier,
      );
      if (!ended) return;

      const shouldRefresh = pullDistanceRef.current >= PULL_TRIGGER_PX;
      resetPull();
      if (!shouldRefresh || refreshingRef.current) return;

      refreshingRef.current = true;
      setRefreshing(true);
      if ("vibrate" in navigator) navigator.vibrate?.(12);
      window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
    }

    function handleTouchCancel() {
      // A cancelled gesture must never trigger a page reload.
      cancelPull();
    }

    // Capture phase is important for standalone iOS PWAs: page-level cards,
    // maps, and gesture components may stop bubbling touch events.
    document.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, {
      capture: true,
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEnd, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchcancel", handleTouchCancel, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart, true);
      document.removeEventListener("touchmove", handleTouchMove, true);
      document.removeEventListener("touchend", handleTouchEnd, true);
      document.removeEventListener("touchcancel", handleTouchCancel, true);
    };
  }, []);

  const visible = refreshing || pullDistance > 0;
  const ready = pullDistance >= PULL_TRIGGER_PX;

  return (
    <div
      className={`global-pull-refresh-indicator ${visible ? "is-visible" : ""} ${refreshing ? "is-refreshing" : ""}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: `translate3d(0, ${visible ? Math.min(74, pullDistance * 0.9) : 0}px, 0)`,
      }}
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span
        className={`global-pull-refresh-spinner ${refreshing ? "is-spinning" : ""}`}
        style={!refreshing ? { transform: `rotate(${pullDistance * 3}deg)` } : undefined}
        aria-hidden
      />
      <span className="sr-only">
        {refreshing ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}
      </span>
    </div>
  );
}
