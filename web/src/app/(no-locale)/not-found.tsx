'use client';

import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { BrandedErrorState } from '@/components/BrandedErrorState';

// Next.js App Router convention: rendered when a page under this tree
// (admin, privacy, terms) calls `notFound()` itself — see
// src/app/[locale]/not-found.tsx's own doc comment for what this does and
// doesn't catch (a URL that matches no route at all goes to
// src/app/global-not-found.tsx instead, not here). This is the
// (no-locale) tree's own copy — plain next/link, not @/i18n/navigation's
// locale-aware Link, since these routes have no locale segment to
// preserve. See BrandedErrorState's own doc comment for why this is
// 'use client'.
export default function NotFound() {
  return (
    <BrandedErrorState
      icon={MagnifyingGlassIcon}
      iconTone="lagoon"
      title="Page not found"
      description="Looks like this page wandered off the map. Let's get you back on the trail."
      homeAction={
        <Link href="/" className="button-secondary">
          Go home
        </Link>
      }
    />
  );
}
