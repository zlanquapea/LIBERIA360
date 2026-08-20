'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { reportError } from '@/lib/error-reporting';

// Next.js App Router route-segment error boundary — catches a render
// error anywhere under this layout without taking down the whole app
// (that's what global-error.tsx is for, one level up). Reports to Sentry
// (a no-op if unconfigured — see lib/error-reporting.ts) before showing a
// friendly retry screen instead of a blank page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Something went wrong</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Sorry about that — this page hit an unexpected error. You can try again, or head back home.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
