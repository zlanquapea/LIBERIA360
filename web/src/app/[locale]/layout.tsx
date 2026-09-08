import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AuthRefresher } from "@/components/AuthRefresher";
import { ErrorReportingInit } from "@/components/ErrorReportingInit";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { Liberia360Assistant } from "@/components/Liberia360Assistant";
import { SplashScreen } from "@/components/SplashScreen";
import { OnboardingTour } from "@/components/OnboardingTour";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { routing, RTL_LOCALES } from "@/i18n/routing";

// i18n (Sep 2026, I18N_PLAN.md): this is one of TWO root layouts (see
// src/app/(no-locale)/layout.tsx's doc comment for why there are two at
// all — Next.js's "multiple root layouts via route groups" pattern).
// Everything tourist-facing lives here, under the [locale] segment:
// Home, Explore, Trip planner, Businesses, Events, Auth, Account, and so
// on. Admin and the legal pages are deliberately elsewhere and never see
// this file.
//
// Phase 2 (Sep 2026, I18N_PLAN.md): Header, Footer, BottomNav, MobileMenu,
// AccountLink, ThemeToggle, NotificationBell, ConfirmDialog, and
// BrandLoader now translate their own copy via next-intl's
// useTranslations() (see the `nav`/`footer`/`common` namespaces in
// messages/*.json). Those components still render in BOTH root layouts —
// the (no-locale) tree gets the same translated components, just pinned
// to English via a static NextIntlClientProvider there (see that layout's
// own doc comment) — and they still use plain next/link, not
// @/i18n/navigation's locale-aware Link, for the same reason.

export const metadata: Metadata = {
  title: "LIBERIA360 — Everything Liberia. One Place.",
  description:
    "Discover Liberia's destinations, food, stays, and experiences — map-first, WhatsApp-first, built county by county.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#081a50",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('liberia360:theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

const splashInitScript = `(function(){try{if(sessionStorage.getItem('liberia360:splash-seen')==='1')document.documentElement.dataset.splashSeen='1';}catch(e){}})();`;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables next-intl's static-rendering optimizations for everything
  // under this layout (see generateStaticParams above) — without this,
  // every page in the [locale] tree is forced into fully dynamic
  // rendering just by having a `params.locale` in the tree.
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = RTL_LOCALES.includes(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={displayFont.variable}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <SplashScreen />
          <OnboardingTour />
          <Header />
          <div
            id="main-content"
            tabIndex={-1}
            className="flex flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none lg:pb-0"
          >
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <BottomNav />
          {/* Standalone for Phase 1 — see LanguageSwitcher's own doc
              comment for why this isn't woven into Header's nav yet.
              left-3, not right-3 (bug fix, Sep 2026): Liberia360Assistant's
              launcher anchors bottom-right by default, so pinning this
              widget to the same side crowded the two together in the same
              corner. Moved to the opposite corner to give each its own
              space — mirrors the assistant's bottom offset rather than
              matching it exactly since this control has no expanding
              panel of its own to clear BottomNav for. */}
          <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom)+0.75rem)] left-3 z-40 lg:bottom-3">
            <LanguageSwitcher />
          </div>
          <Liberia360Assistant />
          <ServiceWorkerRegister />
          <AuthRefresher />
          <ErrorReportingInit />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
