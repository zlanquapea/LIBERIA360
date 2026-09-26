"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { localePath } from "@/lib/locale-path";

// Sits at the bottom of the scrollable content area, above BottomNav's
// sticky tab bar (see app/layout.tsx) — the one place in this mobile-first
// app a visitor can reliably find the legal pages, since there's no
// traditional desktop-style footer elsewhere in the design.
//
// This renders in both root layouts. localePath keeps public links in the
// selected language while legal links intentionally remain English-only.
export function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white px-4 py-10 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-8 sm:px-2 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-md">
          <Link
            href={localePath("/", locale)}
            className="inline-flex items-center font-display text-lg font-extrabold tracking-tight text-brand-900 dark:text-white"
          >
            LIBERIA
            <span className="text-accent-600 dark:text-accent-400">360</span>
          </Link>
          <p className="mt-3 max-w-sm leading-6">{t("tagline")}</p>
        </div>
        <nav
          aria-label={t("footerNavigation")}
          className="flex flex-wrap gap-x-6 gap-y-3 font-semibold"
        >
          <Link
            href={localePath("/places/submit", locale)}
            className="hover:text-brand-700 hover:underline dark:hover:text-brand-200"
          >
            {t("addPlace")}
          </Link>
          <Link
            href="/privacy"
            className="hover:text-brand-700 hover:underline dark:hover:text-brand-200"
          >
            {t("privacy")}
          </Link>
          <Link
            href="/terms"
            className="hover:text-brand-700 hover:underline dark:hover:text-brand-200"
          >
            {t("terms")}
          </Link>
        </nav>
      </div>
      <div className="mx-auto mt-6 max-w-7xl border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-2">
        {t("copyright", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
