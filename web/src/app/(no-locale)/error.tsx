'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { reportError } from '@/lib/error-reporting';
import { BrandedErrorState } from '@/components/BrandedErrorState';

// Next.js App Router route-segment error boundary — catches a render
// error anywhere under this layout without taking down the whole app
// (that's what global-error.tsx is for, one level up). Reports to Sentry
// (a no-op if unconfigured — see lib/error-reporting.ts) before showing a
// branded retry screen instead of a blank page.
//
// This is the (no-locale) tree's own copy (admin, privacy, terms) — plain
// next/link, not @/i18n/navigation's locale-aware Link, since these routes
// have no locale segment to preserve. See src/app/[locale]/error.tsx for
// the tourist-facing tree's copy.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, { digest: error.digest });
  }, [error]);

  return (
    <BrandedErrorState
      icon={ExclamationTriangleIcon}
      iconTone="gold"
      title="Something went wrong"
      description="Sorry about that — this page hit an unexpected error. You can try again, or head back home."
      onRetry={reset}
      homeAction={
        <Link href="/" className="button-secondary">
          Go home
        </Link>
      }
    />
  );
}
