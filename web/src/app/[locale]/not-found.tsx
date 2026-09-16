'use client';

import { useTranslations } from 'next-intl';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Link } from '@/i18n/navigation';
import { BrandedErrorState } from '@/components/BrandedErrorState';

// Next.js App Router convention: rendered when a page or layout under this
// tree calls `notFound()` itself — an unknown place/business/event slug,
// say. NOT rendered for a URL that just doesn't match any route at all
// (a typo, a stale link): per Next.js's own docs, only a *root*
// not-found.tsx catches that, and this app's actual root — it has two
// parallel ones, see next.config.js's `globalNotFound` comment — is
// src/app/global-not-found.tsx instead. See BrandedErrorState's own doc
// comment for why this is 'use client' + useTranslations rather than the
// server-side getTranslations() a plain page.tsx would use.
export default function NotFound() {
  const t = useTranslations('common');

  return (
    <BrandedErrorState
      icon={MagnifyingGlassIcon}
      iconTone="brand"
      title={t('pageNotFoundTitle')}
      description={t('pageNotFoundDescription')}
      homeAction={
        <Link href="/" className="button-secondary">
          {t('goHome')}
        </Link>
      }
    />
  );
}
