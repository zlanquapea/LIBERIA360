"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

const PULL_TRIGGER_PX = 68;
const MAX_PULL_PX = 104;
const PULL_RESISTANCE = 0.55;

type TouchOrigin = {
  x: number;
  y: number;
  target: EventTarget | null;
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "a, button, input, select, textarea, summary, [contenteditable='true'], [role='button'], [data-no-pull-refresh]",
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
      if (scrollableY) return element.scrollTop > 0;
    }
    element = element.parentElement;
  }
  return false;
}

function canStartPull(target: EventTarget | null): boolean {
  if (document.body.classList.contains("messaging-chat")) return false;
  if (isInteractiveTarget(target)) return false;
  if (target instanceof Element && target.closest(".creator-feed-pull-shell")) {
    return false;
  }
  if (hasScrollableParentAtOffset(target)) return false;
  return window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
}

export function PullToRefresh() {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const originRef = useRef<TouchOrigin | null>(null);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    function resetPull() {
      originRef.current = null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    function handleTouchStart(event: globalThis.TouchEvent) {
      if (refreshingRef.current || !canStartPull(event.target)) return;
      const touch = event.touches[0];
      if (touch) {
        originRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          target: event.target,
        };
      }
    }

    function handleTouchMove(event: globalThis.TouchEvent) {
      const origin = originRef.current;
      const touch = event.touches[0];
      if (!origin || !touch || refreshingRef.current) return;

      if (
        window.scrollY > 0 ||
        document.documentElement.scrollTop > 0 ||
        hasScrollableParentAtOffset(origin.target)
      ) {
        resetPull();
        return;
      }

      const deltaX = touch.clientX - origin.x;
      const deltaY = touch.clientY - origin.y;
      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        resetPull();
        return;
      }

      // Prevent the browser's native overscroll refresh only after the gesture
      // is clearly a vertical pull, preserving normal horizontal gestures.
      event.preventDefault();
      const nextDistance = Math.min(
        MAX_PULL_PX,
        Math.round(deltaY * PULL_RESISTANCE),
      );
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);
    }

    function handleTouchEnd() {
      const shouldRefresh = pullDistanceRef.current >= PULL_TRIGGER_PX;
      resetPull();
      if (!shouldRefresh || refreshingRef.current) return;

      refreshingRef.current = true;
      setRefreshing(true);
      if ("vibrate" in navigator) navigator.vibrate?.(12);
      window.setTimeout(() => window.location.reload(), 220);
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  const visible = refreshing || pullDistance > 0;
  const ready = pullDistance >= PULL_TRIGGER_PX;

  return (
    <div
      className={`global-pull-refresh-indicator ${visible ? "is-visible" : ""} ${refreshing ? "is-refreshing" : ""}`}
      style={{ height: visible ? (refreshing ? 52 : pullDistance) : 0 }}
      aria-live="polite"
      aria-hidden={!visible}
    >
      <span>
        <ArrowPathIcon
          aria-hidden
          className={`global-pull-refresh-icon ${refreshing ? "is-spinning" : ""}`}
          style={
            !refreshing && pullDistance > 0
              ? { transform: `rotate(${pullDistance * 3}deg)` }
              : undefined
          }
        />
        {refreshing ? "Refreshing…" : ready ? "Release to refresh" : "Pull to refresh"}
      </span>
    </div>
  );
}
