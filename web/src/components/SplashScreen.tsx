'use client';

import { useEffect, useState } from 'react';

// How long the splash stays fully visible before it starts fading, and how
// long the fade itself takes (matches the `duration-500` class below) —
// kept as named constants since both the visible timer and the unmount
// timer need to agree on the fade length.
const MIN_VISIBLE_MS = 500;
const FADE_MS = 500;

/**
 * First-load splash — the app's own "cold start" screen, shown once per
 * real page load while the app is booting up, the same way a native app
 * shows a splash while its process starts. Mounted as the very first thing
 * in `<body>` (see layout.tsx), so it's part of the initial server-rendered
 * HTML and paints before any JS has run, not just after hydration.
 *
 * Only ever shown once per hard navigation: this component lives in the
 * root layout, which the App Router mounts once and keeps mounted (never
 * remounts) across client-side route changes — a visitor clicking around
 * the app afterwards never sees it again, exactly like a native app's
 * splash only appearing on a cold launch, not on every screen.
 *
 * Deliberately doesn't gate on any network resource finishing (a
 * `window.load` listener, a data fetch, ...) — nothing here can hang.
 * Instead it hides itself on a fixed, short timer once hydration has
 * actually completed (the `useEffect` below only runs client-side, after
 * React has taken over), with a floor short enough to feel instant but
 * long enough that the brand moment isn't a single-frame flicker on a fast
 * connection.
 */
export function SplashScreen() {
  const [hiding, setHiding] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setHiding(true), MIN_VISIBLE_MS);
    const unmountTimer = setTimeout(() => setMounted(false), MIN_VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-brand-900 transition-opacity duration-500 ${
        hiding ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* Decorative to sighted users (the real app behind it announces its
          own content once it's ready) — this is purely a "something is
          happening" cue for a screen reader user in the same brief window. */}
      <span className="sr-only" role="status">
        Loading LIBERIA360…
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element -- must paint
          before any JS (Next's own Image runtime included) is ready */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={72}
        height={72}
        className="h-16 w-16 animate-float rounded-2xl shadow-lg motion-reduce:animate-none"
      />
      <p className="animate-fade-in font-display text-lg font-semibold tracking-wide text-white motion-reduce:animate-none">
        LIBERIA360
      </p>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/15">
        <div className="h-full w-1/3 animate-splash-bar rounded-full bg-white/90 motion-reduce:hidden" />
      </div>
    </div>
  );
}
