"use client";

import { useEffect, useRef, useState } from "react";
import { BookingRequestSection } from "./BookingRequestSection";
import type { Business } from "@/lib/types";

// UX audit (Sep 6, 2026): the primary "Book"/"Request to book" action only
// ever lived inline in the Helpful Actions grid near the top of a place or
// business page — scroll past it once (the whole point of a long detail
// page) and it's gone until you scroll all the way back up. Tourism-app
// best practice calls for a persistent bottom booking CTA on a detail
// page; this reuses BookingRequestSection itself (mode="link") rather than
// duplicating its logic, so every state it already handles — the guest
// login prompt, "you manage this listing", etc. — comes along for free.
//
// Mount this once, right after the inline Helpful Actions section on a
// page. The invisible sentinel below tracks that mount point: once it
// scrolls above the viewport (the inline card, and its own Book button,
// are no longer visible) the bar slides up from the bottom; scroll back up
// past it and the bar hides again, so a visitor near the top never sees
// the same CTA twice at once.
//
// Sits above BottomNav's fixed tab bar on mobile — BottomNav reserves
// `5rem + env(safe-area-inset-bottom)` at the page bottom (see
// app/layout.tsx's `#main-content` padding) — and flush to the viewport
// bottom on desktop, where BottomNav doesn't render at all.
//
// z-[85] (bug fix, Sep 2026): that same reserved strip above BottomNav is
// also where the global LanguageSwitcher (z-40) and Liberia360Assistant
// launcher (z-[80]) rest by default — both render on every page, this bar
// only on a business/place page once scrolled. At the old z-20 this bar's
// own primary "Book"/"Log in to book" button sat *underneath* both of
// them, so the language switcher's pill (and, depending on scroll
// position, the assistant bubble) visually covered and intercepted every
// tap meant for the page's actual conversion CTA. Outranking both makes
// this contextual, user-triggered bar win the strip while it's visible;
// the switcher/launcher are still there and reappear the moment this bar
// hides again on scroll-up, so nothing is lost — just briefly deferred to.
export function StickyBookingBar({
  business,
  name,
}: {
  business: Business;
  name: string;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only care about "scrolled past above" (boundingClientRect.top <
        // 0), not the initial "hasn't been reached yet" state below the
        // fold, which also reports isIntersecting: false.
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      <div
        aria-hidden={!visible}
        inert={visible ? undefined : true}
        className={`fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[85] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] backdrop-blur transition-transform duration-200 ease-out supports-[backdrop-filter]:bg-white/85 dark:border-slate-800 dark:bg-slate-900/95 lg:bottom-0 ${
          visible ? "translate-y-0" : "pointer-events-none translate-y-full"
        }`}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3 lg:max-w-6xl">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
              {name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ready to book your visit?
            </p>
          </div>
          <div className="w-36 shrink-0 sm:w-48">
            <BookingRequestSection
              business={business}
              mode="link"
              href={`/businesses/${business.slug}/book`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
