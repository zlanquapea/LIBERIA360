'use client';

import { useTranslations } from 'next-intl';
import { BrandLoader } from '@/components/BrandLoader';

// Next.js's App Router convention: automatically wraps every route segment
// under app/ in a Suspense boundary and shows this while that segment is
// still being prepared (a server component's data, or a client route's own
// code chunk on navigation) — no per-page wiring needed, so this is the
// "still loading" moment for the whole site, not just one screen. Uses the
// same branded orbiting-rings treatment (BrandLoader) as any page that
// wants its own inline loading state, rather than a generic spinner or a
// content-shaped skeleton — see that component's doc comment for why.
//
// 'use client' + useTranslations (not getTranslations from next-intl/server):
// loading.tsx is a Next.js file-convention special file, not a normal
// page/layout — it doesn't receive the resolved `params` the way page.tsx
// and layout.tsx do, so it never runs inside the per-locale
// setRequestLocale() context that [locale]/layout.tsx establishes.
// getTranslations() here fell through to next-intl's request-header-based
// locale detection instead, which is a genuine Dynamic API read — and
// because this file is shared across every static route in the app, that
// single dynamic read was enough to force the *entire* site (both the
// [locale] tree and, transitively, every other route) into fully dynamic
// rendering, wiping out static/SSG generation completely. useTranslations
// reads from the NextIntlClientProvider already established higher up in
// [locale]/layout.tsx's render tree via React context — no server-side
// request access, so it can't reintroduce that bailout. See I18N_PLAN.md.
export default function Loading() {
  const t = useTranslations('common');
  return (
    <main
      className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-5"
      aria-busy="true"
      aria-label={t('loadingSite')}
    >
      <BrandLoader />
      <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">{t('loading')}</p>
    </main>
  );
}
