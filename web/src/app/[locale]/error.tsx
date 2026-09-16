'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Link } from '@/i18n/navigation';
import { reportError } from '@/lib/error-reporting';
import { BrandedErrorState } from '@/components/BrandedErrorState';

// Next.js App Router route-segment error boundary — catches a render
// error anywhere under this layout without taking down the whole app
// (that's what global-error.tsx is for, one level up). Reports to Sentry
// (a no-op if unconfigured — see lib/error-reporting.ts) before showing a
// branded retry screen instead of a blank page — see BrandedErrorState's
// own doc comment for why this no longer hand-rolls its own plain markup.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common');

  useEffect(() => {
    reportError(error, { digest: error.digest });
  }, [error]);

  return (
    <BrandedErrorState
      icon={ExclamationTriangleIcon}
      iconTone="gold"
      title={t('somethingWentWrong')}
      description={t('errorDescription')}
      onRetry={reset}
      homeAction={
        <Link href="/" className="button-secondary">
          {t('goHome')}
        </Link>
      }
    />
  );
}
