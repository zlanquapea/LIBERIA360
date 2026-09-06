"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { MOBILE_MENU_NAVIGATION } from "@/lib/site-nav";

// Facebook-style hamburger drawer (product note, Sep 6, 2026): Header's
// full section list (Explore, Car Rentals, Saved, Help, ...) only ever
// rendered in the lg+ inline nav row — a mobile visitor had no way to
// reach any of those short of already knowing the URL or landing on a
// homepage tile for it. This is that way in, sitting left of the logo
// exactly where Facebook's own app puts its equivalent.
//
// Renders MOBILE_MENU_NAVIGATION, not SITE_NAVIGATION — this drawer only
// exists alongside BottomNav, so it deliberately skips whatever's already
// a bottom tab (Counties/Events/Creators) rather than listing the same
// destination twice on one screen; see that list's own doc comment for
// what took their place.
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { user, ready } = useAuth();

  // Same lock-scroll + Escape-to-close pattern as the other full-screen
  // overlays in this app (see CreatorPostViewer) — kept independent of
  // that component rather than shared, since this one is a side drawer
  // and CreatorPostViewer's is a full black viewer with different chrome.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 lg:hidden"
      >
        <Bars3Icon aria-hidden className="h-6 w-6" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        // Portalled to <body> rather than left in place: this button lives
        // inside <header>, which has `backdrop-blur-xl` — a backdrop-filter
        // establishes a containing block for `position: fixed` descendants
        // exactly like `filter` does, so an un-portalled overlay here would
        // be confined to the header's own ~4.5rem box instead of the
        // viewport (caught visually — the drawer rendered as a sliver
        // pinned to the header instead of a full-height panel). Same fix
        // CreatorPostMedia already uses for its viewer overlay.
        createPortal(
          <div role="dialog" aria-modal="true" aria-label="Site menu" className="fixed inset-0 z-[120] lg:hidden">
            <div aria-hidden className="absolute inset-0 bg-black/50" onClick={close} />
            <div className="relative flex h-full w-[82%] max-w-xs flex-col overflow-y-auto bg-white shadow-2xl dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 dark:border-slate-800">
                {ready && user ? (
                  <Link href="/account" onClick={close} className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
                      {user.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {user.name}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">View account</span>
                    </span>
                  </Link>
                ) : (
                  <Link href="/login" onClick={close} className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                    Log in / Sign up
                  </Link>
                )}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <XMarkIcon aria-hidden className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label="Site sections" className="flex flex-col gap-1 p-3">
                {MOBILE_MENU_NAVIGATION.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={close}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Icon aria-hidden className="h-5 w-5 text-brand-700 dark:text-brand-300" />
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
