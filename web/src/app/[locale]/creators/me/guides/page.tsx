'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getMyGuides } from '@/lib/creator-guides-api';
import { HttpError } from '@/lib/http';
import { BrandLoader } from '@/components/BrandLoader';
import { GuideStatusBadge } from '@/components/creator-guides/GuideStatusBadge';
import type { CreatorGuide } from '@/lib/types';

// A creator's own guides at every stage: drafts, waiting for review,
// published, or sent back with the reviewer's note.
export default function MyGuidesPage() {
  const t = useTranslations('creatorGuides');
  const { token, ready } = useAuth();
  const [guides, setGuides] = useState<CreatorGuide[] | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    getMyGuides(token)
      .then(setGuides)
      .catch((err) => setError({ status: err instanceof HttpError ? err.status : 0, message: err instanceof Error ? err.message : '' }));
  }, [ready, token]);

  if (ready && !token) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/login?next=/creators/me/guides" className="font-semibold text-brand-700 underline">
          {t('loginToWrite')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/creators/me" className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
            ← {t('backToStudio')}
          </Link>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">{t('myGuides')}</h1>
        </div>
        {!error && (
          <Link href="/creators/me/guides/new" className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">
            <PlusIcon aria-hidden className="h-4 w-4" />
            {t('newGuide')}
          </Link>
        )}
      </div>

      {error ? (
        error.status === 403 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-5 dark:border-slate-700">
            <p className="text-slate-700 dark:text-slate-200">{t('needCreatorProfile')}</p>
            <Link href="/creators/me" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-4 text-sm font-semibold text-white">
              {t('setUpProfile')}
            </Link>
          </div>
        ) : (
          <p role="alert" className="text-flag-700 dark:text-flag-300">{error.message || t('actionError')}</p>
        )
      ) : guides === null ? (
        <BrandLoader />
      ) : guides.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-5 text-slate-600 dark:border-slate-700 dark:text-slate-300">{t('noGuidesYet')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {guides.map((g) => (
            <li key={g.id}>
              <Link href={`/creators/me/guides/${g.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-500 dark:border-slate-800 dark:bg-slate-900">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-900 dark:text-slate-50">{g.title}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t('placeCount', { count: g.stops.length })}</span>
                  {g.status === 'rejected' && g.rejectionReason && (
                    <span className="mt-1 block text-xs text-flag-700 dark:text-flag-300">{g.rejectionReason}</span>
                  )}
                </span>
                <GuideStatusBadge status={g.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
