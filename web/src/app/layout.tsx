import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { AuthRefresher } from '@/components/AuthRefresher';
import { ErrorReportingInit } from '@/components/ErrorReportingInit';
import { SplashScreen } from '@/components/SplashScreen';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'LIBERIA360 — Everything Liberia. One Place.',
  description:
    "Discover Liberia's destinations, food, stays, and experiences — map-first, WhatsApp-first, built county by county.",
  manifest: '/manifest.webmanifest',
  // Favicon/app icon comes from the app/icon.png file convention (Next.js
  // auto-generates the <link rel="icon"> tags from it).
};

export const viewport: Viewport = {
  themeColor: '#081a50',
  width: 'device-width',
  initialScale: 1,
};

// Self-hosted at build time by next/font (no runtime request to Google
// Fonts, no font-swap flash) — used for headings only, see
// tailwind.config.ts's `fontFamily.display`.
const displayFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

// Runs before hydration, before first paint — reads the stored theme (or
// falls back to OS preference) and applies the `dark` class synchronously.
// Without this, the page would always flash light-then-dark on every load
// for anyone who's chosen dark mode, since useTheme's effect can't run
// until after React hydrates. Inlined (not next/script) specifically
// because it has to block, not defer.
const themeInitScript = `(function(){try{var t=localStorage.getItem('liberia360:theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={displayFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 dark:bg-slate-950 dark:text-slate-50">
        <SplashScreen />
        <Header />
        <div className="flex-1 pb-20 lg:pb-0">
          {children}
          <Footer />
        </div>
        <BottomNav />
        <ServiceWorkerRegister />
        <AuthRefresher />
        <ErrorReportingInit />
      </body>
    </html>
  );
}
