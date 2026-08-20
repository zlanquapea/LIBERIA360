'use client';

import { useEffect } from 'react';
import './globals.css';
import { reportError } from '@/lib/error-reporting';

// The root-layout-level error boundary — catches an error severe enough to
// take out layout.tsx itself (error.tsx above only covers errors under it,
// not in the layout that renders it). Per Next.js's own contract for this
// file, it replaces the entire root layout when triggered, so it has to
// render its own <html>/<body> and re-import the global stylesheet —
// nothing from layout.tsx (header, bottom nav, globals.css) is there to
// fall back on.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { digest: error.digest, scope: 'root-layout' });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Something went wrong</h1>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Sorry about that — LIBERIA360 hit an unexpected error. Try again, or reload the page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
