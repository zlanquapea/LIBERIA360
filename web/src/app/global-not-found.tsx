import Image from 'next/image';
import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { Metadata } from 'next';
import './globals.css';

// Next.js's dedicated fix for a site with multiple root layouts and no
// single app/layout.tsx above them (see next.config.js's `globalNotFound`
// comment for why this app needs it, and [locale]/not-found.tsx's for
// exactly what that file catches instead of this one): any URL that
// doesn't match a real route — a typo, a stale link, an invalid locale
// segment — has no layout left to render inside, so Next.js "skips
// rendering" entirely and serves this instead, at the routing level,
// app-wide.
//
// Bypasses the app's normal rendering (per Next.js's own contract for this
// file) — no NextIntlClientProvider, no theme-detection script, so this is
// hardcoded English and light-mode-only (`prefers-color-scheme` still
// applies via the OS, same limitation global-error.tsx already has for the
// same reason). Reuses the same "logo mark in a soft halo" visual as
// BrandedErrorState/global-error.tsx rather than falling back to Next's
// plain "404 | This page could not be found." default.
export const metadata: Metadata = {
  title: 'Page not found — LIBERIA360',
  description: 'The page you are looking for does not exist.',
};

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-200 via-brand-100 to-brand-200 opacity-90 blur-md"
          />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-card ring-1 ring-black/5">
            <Image src="/logo.png" alt="" width={64} height={64} className="h-14 w-14 object-contain" />
          </span>
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-700 shadow-md ring-4 ring-white">
            <MagnifyingGlassIcon aria-hidden className="h-5 w-5" />
          </span>
        </div>
        <div className="flex max-w-sm flex-col gap-2">
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-950">
            Page not found
          </h1>
          <p className="text-sm leading-6 text-slate-600">
            Looks like this page wandered off the map. Let&apos;s get you back on the trail.
          </p>
        </div>
        <Link href="/" className="button-secondary">
          Go home
        </Link>
      </body>
    </html>
  );
}
