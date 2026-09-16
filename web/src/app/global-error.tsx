'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import './globals.css';
import { reportError } from '@/lib/error-reporting';

// The root-layout-level error boundary — catches an error severe enough to
// take out layout.tsx itself (error.tsx above only covers errors under it,
// not in the layout that renders it). Per Next.js's own contract for this
// file, it replaces the entire root layout when triggered, so it has to
// render its own <html>/<body> and re-import the global stylesheet —
// nothing from layout.tsx (header, bottom nav, globals.css) is there to
// fall back on. That includes the NextIntlClientProvider both root layouts
// establish, so — unlike error.tsx/not-found.tsx — this can't use
// useTranslations or import BrandedErrorState (which needs that provider);
// it hand-rolls the same "logo mark in a soft halo" visual instead of
// falling back to plain text, English-only, same as this file already was.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { digest: error.digest, scope: 'root-layout' });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-gradient-to-br from-gold-200 via-brand-100 to-brand-200 opacity-90 blur-md dark:from-gold-900/40 dark:via-brand-900/30 dark:to-brand-900/60"
          />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-card ring-1 ring-black/5 dark:bg-slate-900 dark:ring-white/10">
            <Image src="/logo.png" alt="" width={64} height={64} className="h-14 w-14 object-contain" />
          </span>
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gold-700 shadow-md ring-4 ring-white dark:bg-slate-800 dark:text-gold-300 dark:ring-slate-950">
            <ExclamationTriangleIcon aria-hidden className="h-5 w-5" />
          </span>
        </div>
        <div className="flex max-w-sm flex-col gap-2">
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-slate-950 dark:text-white">
            Something went wrong
          </h1>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            Sorry about that — LIBERIA360 hit an unexpected error. Try again, or reload the page.
          </p>
        </div>
        <button type="button" onClick={reset} className="button-primary">
          Try again
        </button>
      </body>
    </html>
  );
}
