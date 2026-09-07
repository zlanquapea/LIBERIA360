import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
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

// i18n (Sep 2026, I18N_PLAN.md): this is one of TWO root layouts, using
// Next.js's "multiple root layouts via route groups" pattern — the other
// is src/app/[locale]/layout.tsx. Admin and the legal pages (Privacy,
// Terms) live in THIS group specifically because product decided they
// stay English-only regardless of how many locales the tourist-facing
// side of the app eventually supports: no [locale] segment, no
// NextIntlClientProvider, nothing here ever changes based on a visitor's
// language choice. Content below is otherwise unchanged from before the
// split — same chrome, same behavior, just now duplicated by necessity
// into the other root layout too (see that file's own doc comment).

export const metadata: Metadata = {
  title: "LIBERIA360 — Everything Liberia. One Place.",
  description:
    "Discover Liberia's destinations, food, stays, and experiences — map-first, WhatsApp-first, built county by county.",
  manifest: "/manifest.webmanifest",
  // Favicon/app icon comes from the app/icon.png file convention, and the
  // iOS home-screen icon from app/apple-icon.png — Next.js auto-generates
  // the <link rel="icon">/<link rel="apple-touch-icon"> tags from them.
};

export const viewport: Viewport = {
  themeColor: "#081a50",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Self-hosted at build time by next/font (no runtime request to Google
// Fonts, no font-swap flash) — used for headings only, see
// tailwind.config.ts's `fontFamily.display`.
const displayFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

// Runs before hydration, before first paint — reads the stored theme (or
// falls back to OS preference) and applies the `dark` class synchronously.
// Without this, the page would always flash light-then-dark on every load
// for anyone who's chosen dark mode, since useTheme's effect can't run
// until after React hydrates. Inlined (not next/script) specifically
// because it has to block, not defer.
const themeInitScript = `(function(){try{var t=localStorage.getItem('liberia360:theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

// Hide the SSR splash before the first paint on repeat visits. First visits
// deliberately keep the splash visible in the server HTML so page content
// cannot flash before the branded reveal begins.
const splashInitScript = `(function(){try{if(sessionStorage.getItem('liberia360:splash-seen')==='1')document.documentElement.dataset.splashSeen='1';}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={displayFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
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
          {/* A flex column with the page content as its own flex-1 item and
              Footer after it — so Footer always sits at the true bottom of
              the space between Header and BottomNav, however tall the page
              content is. Before this, Footer sat directly under `children`
              in normal document flow: fine once a page's content was tall
              enough to push it down, but on a short page — or, worse, while
              a page was still loading and had rendered little or nothing —
              Footer collapsed up right under the header, leaving a large
              empty gap below it instead of at the bottom where it belongs. */}
          <div className="flex-1">{children}</div>
          <Footer />
        </div>
        <BottomNav />
        <Liberia360Assistant />
        <ServiceWorkerRegister />
        <AuthRefresher />
        <ErrorReportingInit />
      </body>
    </html>
  );
}
