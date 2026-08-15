import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'LIBERIA360 — Everything Liberia. One Place.',
  description:
    "Discover Liberia's destinations, food, stays, and experiences — map-first, WhatsApp-first, built county by county.",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#1f7c57',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <div className="flex-1">{children}</div>
        <BottomNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
