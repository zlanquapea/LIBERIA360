import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { AuthRefresher } from '@/components/AuthRefresher';
import { ErrorReportingInit } from '@/components/ErrorReportingInit';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1">
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
