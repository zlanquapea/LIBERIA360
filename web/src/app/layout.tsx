import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AuthRefresher } from "@/components/AuthRefresher";
import { ErrorReportingInit } from "@/components/ErrorReportingInit";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { Footer } from "@/components/Footer";
import { Liberia360Assistant } from "@/components/Liberia360Assistant";
import { SplashScreen } from "@/components/SplashScreen";

export const metadata: Metadata = {
  title: "LIBERIA360 — Everything Liberia. One Place.",
  description:
    "Discover Liberia's destinations, food, stays, and experiences — map-first, WhatsApp-first, built county by county.",
  manifest: "/manifest.webmanifest",
  // Favicon/app icon comes from the app/icon.png file convention (Next.js
  // auto-generates the <link rel="icon"> tags from it).
};

export const viewport: Viewport = {
  themeColor: "#081a50",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

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

// Splash screen removed (Aug 27, 2026): product feedback — "remove the
// fade in and out... causing the page to fade in color off and on...
// it looks playful, not professional." The old <SplashScreen /> covered
// the whole viewport with a solid brand-color overlay on every hard
// load, held it for a fixed 500ms even though nothing real was loading,
// then faded it out over another 500ms — a full-screen color fade with
// no functional purpose (it never gated on any real resource; see its
// removed doc comment). That's a native-app affectation, not something a
// web app benefits from: real content now paints as soon as it's ready,
// with no artificial delay or overlay in front of it.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 dark:bg-slate-950 dark:text-slate-50">
        <SplashScreen />
        <Header />
        <div className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
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
