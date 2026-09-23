"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { useGuideUnreadCount } from "@/hooks/useGuideUnreadCount";
import { SITE_NAVIGATION } from "@/lib/site-nav";
import { AccountLink } from "./AccountLink";
import { GlobalSearch } from "./GlobalSearch";
import { MobileMenu } from "./MobileMenu";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

// 'use client' (i18n, Sep 2026): useTranslations() needs to read from
// whichever NextIntlClientProvider is above it in the tree — the [locale]
// layout's real one, or the (no-locale) layout's English-pinned one (see
// that layout's own doc comment) — and Server Components can't consume a
// context a Client Component provides. Plain <Link>/<a> below are
// intentional too: this renders in BOTH root layouts, and @/i18n/navigation's
// locale-aware Link requires the same provider context that (no-locale)
// deliberately never has real i18n behind. An unprefixed Link still
// resolves correctly for every locale (next-intl's own middleware redirects
// to the locale-prefixed URL using the visitor's cookie) — it just costs an
// extra hop instead of an instant client-side transition for non-English
// locales. See I18N_PLAN.md if that hop needs closing later.
export function Header() {
  const t = useTranslations("nav");
  const { user, ready } = useAuth();
  const unreadCount = useGuideUnreadCount();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-900/95 text-white shadow-[0_8px_24px_rgba(0,47,59,0.16)] backdrop-blur-xl supports-[backdrop-filter]:bg-brand-900/90">
      <div className="mx-auto flex min-h-[4.5rem] max-w-[90rem] items-center justify-between gap-3 px-3 py-1.5 sm:px-6 lg:px-10">
        <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
          {/* Below lg, this is the only way to reach SITE_NAVIGATION at
              all — the inline nav to its right only renders at lg+. See
              MobileMenu's own doc comment for why. */}
          <MobileMenu />
          <Link
            href="/"
            className="group flex shrink-0 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            aria-label={t("homeLink")}
          >
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-white/20 sm:h-14 sm:w-14">
            <Image
              src="/logo.png"
              alt="LIBERIA360"
              width={160}
              height={160}
              priority
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            />
            </span>
            <span className="ms-2 hidden font-display text-sm font-extrabold tracking-[0.05em] sm:inline">
              LIBERIA<span className="text-gold-400">360</span>
            </span>
            <span className="sr-only">
              LIBERIA360 — Everything Liberia. One Place.
            </span>
          </Link>
        </div>
        <nav
          aria-label={t("mainNavigation")}
          className="hidden min-w-0 items-center justify-center gap-1 lg:flex"
        >
          {SITE_NAVIGATION.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-semibold text-brand-100 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <GlobalSearch />
          <ThemeToggle />
          <NotificationBell />
          {ready && user && (
            <Link
              href="/messages"
              aria-label={unreadCount > 0 ? t("messagesUnread", { count: unreadCount }) : t("messages")}
              title={t("messages")}
              className="group relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 via-gold-400 to-amber-500 text-brand-950 shadow-[0_4px_12px_rgba(251,191,36,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(251,191,36,0.4)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900"
            >
              <ChatBubbleLeftRightIcon aria-hidden className="h-[1.15rem] w-[1.15rem] transition-transform duration-200 group-hover:scale-110" />
              {unreadCount > 0 && (
                <span aria-hidden className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-brand-900 bg-flag-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          <AccountLink />
        </div>
      </div>
    </header>
  );
}
