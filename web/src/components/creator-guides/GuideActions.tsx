'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BookmarkIcon as BookmarkOutline, BriefcaseIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { useAuth } from '@/hooks/useAuth';
import { copyGuideToTrip, getSavedGuideIds, saveGuide, unsaveGuide } from '@/lib/creator-guides-api';
import { recordTripCreated } from '@/lib/analytics-api';
import { HttpError } from '@/lib/http';
import { ShareMenu } from '@/components/ShareMenu';

// Save the guide, turn it into a trip of your own, or share it. Signed-out
// visitors are sent to log in and brought back here.
export function GuideActions({ guideId, title }: { guideId: string; title: string }) {
  const t = useTranslations('creatorGuides');
  const { token, ready } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'save' | 'trip' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !token) return;
    let cancelled = false;
    getSavedGuideIds(token)
      .then((ids) => !cancelled && setSaved(ids.includes(guideId)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [ready, token, guideId]);

  const loginHref = `/login?next=${encodeURIComponent(pathname ?? '/')}`;
  const button =
    'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-60';

  async function toggleSave() {
    if (!token) return;
    setBusy('save');
    setError(null);
    try {
      if (saved) await unsaveGuide(token, guideId);
      else await saveGuide(token, guideId);
      setSaved(!saved);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('actionError'));
    } finally {
      setBusy(null);
    }
  }

  async function useAsTrip() {
    if (!token) return;
    setBusy('trip');
    setError(null);
    try {
      const trip = await copyGuideToTrip(token, guideId);
      recordTripCreated();
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : t('actionError'));
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {token ? (
          <>
            <button type="button" onClick={useAsTrip} disabled={busy !== null} className={`${button} bg-brand-700 text-white hover:bg-brand-800`}>
              <BriefcaseIcon aria-hidden className="h-4 w-4" />
              {busy === 'trip' ? t('creatingTrip') : t('useAsTrip')}
            </button>
            <button
              type="button"
              onClick={toggleSave}
              disabled={busy !== null}
              aria-pressed={saved}
              className={`${button} border border-slate-300 text-slate-800 hover:border-brand-500 dark:border-slate-700 dark:text-slate-100`}
            >
              {saved ? <BookmarkSolid aria-hidden className="h-4 w-4 text-brand-700 dark:text-brand-300" /> : <BookmarkOutline aria-hidden className="h-4 w-4" />}
              {saved ? t('saved') : t('save')}
            </button>
          </>
        ) : (
          <>
            <Link href={loginHref} className={`${button} bg-brand-700 text-white hover:bg-brand-800`}>
              <BriefcaseIcon aria-hidden className="h-4 w-4" />
              {t('useAsTrip')}
            </Link>
            <Link href={loginHref} className={`${button} border border-slate-300 text-slate-800 dark:border-slate-700 dark:text-slate-100`}>
              <BookmarkOutline aria-hidden className="h-4 w-4" />
              {t('save')}
            </Link>
          </>
        )}
        <div className="h-11 w-11">
          <ShareMenu placeName={title} />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
    </div>
  );
}
