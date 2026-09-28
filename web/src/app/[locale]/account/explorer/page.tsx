'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { getExplorerProgress } from '@/lib/visited-places-api';
import { getFriendlyErrorMessage } from '@/lib/errors';
import { BrandLoader } from '@/components/BrandLoader';
import { PageHeader } from '@/components/PageHeader';
import { absoluteUrl } from '@/lib/site';
import type { ExplorerProgress } from '@/lib/types';

// "Explorer" — self-reported visited places (see VisitedPlace's doc
// comment on why this is deliberately not "Bucket List"). Client-only,
// same reasoning as /account/bookings: JWT auth lives in localStorage, so
// a server component can't know who's asking.
export default function ExplorerPage() {
  const { user, token, ready, updateProfile } = useAuth();
  const [progress, setProgress] = useState<ExplorerProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [togglingPublic, setTogglingPublic] = useState(false);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    getExplorerProgress(token)
      .then((p) => {
        if (!cancelled) setProgress(p);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getFriendlyErrorMessage(err, { context: { action: 'load-explorer-progress' } }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  async function handleTogglePublic() {
    if (!token || !user) return;
    setTogglingPublic(true);
    try {
      await updateProfile({ explorerProfilePublic: !user.explorerProfilePublic });
    } catch (err) {
      setLoadError(getFriendlyErrorMessage(err, { context: { action: 'toggle-explorer-public' } }));
    } finally {
      setTogglingPublic(false);
    }
  }

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Explorer</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to track the places you&apos;ve visited.</p>
        <Link href="/login" className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="page-shell max-w-3xl">
      <PageHeader
        eyebrow="Your progress"
        title="Explorer"
        description="Mark places visited as you go and watch your Liberia progress grow."
      />

      {loadError && (
        <p role="alert" className="error-state">
          {loadError}
        </p>
      )}

      {progress && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="surface-card p-4 text-center">
              <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{progress.visitedPlacesCount}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Places visited</p>
            </div>
            <div className="surface-card p-4 text-center">
              <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">
                {progress.countiesVisited.length}
                <span className="text-lg text-slate-400">/{progress.totalCounties}</span>
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Counties visited</p>
            </div>
          </div>

          <section className="surface-card p-5">
            <h2 className="page-title text-lg">Badges</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {progress.badges.map((badge) => (
                <li
                  key={badge.id}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center ${
                    badge.achieved
                      ? 'border-gold-300 bg-gold-50 dark:border-gold-700 dark:bg-gold-900/20'
                      : 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  {badge.achieved ? (
                    <CheckCircleIcon aria-hidden className="h-6 w-6 text-gold-500" />
                  ) : (
                    <LockClosedIcon aria-hidden className="h-6 w-6 text-slate-400" />
                  )}
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{badge.label}</span>
                </li>
              ))}
            </ul>
          </section>

          {progress.countiesVisited.length > 0 && (
            <section className="surface-card p-5">
              <h2 className="page-title text-lg">Counties you&apos;ve explored</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {progress.countiesVisited.map((county) => (
                  <span key={county.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {county.name}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="surface-card flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="page-title text-lg">Public profile</h2>
                <p className="page-description mt-1">
                  Share your Explorer progress with a public link. Off by default.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={user.explorerProfilePublic}
                onClick={handleTogglePublic}
                disabled={togglingPublic}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                  user.explorerProfilePublic ? 'bg-brand-700' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    user.explorerProfilePublic ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {user.explorerProfilePublic && (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                Your link: <span className="font-medium">{absoluteUrl(`/explorers/${user.id}`)}</span>
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}
