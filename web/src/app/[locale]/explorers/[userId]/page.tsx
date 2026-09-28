'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { getPublicExplorerProfile } from '@/lib/visited-places-api';
import { HttpError } from '@/lib/http';
import { BrandLoader } from '@/components/BrandLoader';
import { PageHeader } from '@/components/PageHeader';
import type { PublicExplorerProfile } from '@/lib/types';

// A signed-in traveler's opt-in public Explorer profile. Client-only,
// same shape as /trips/community — no auth required to view, but the
// backend 404s the same way for an unknown id and an id that exists but
// hasn't opted in (see VisitedPlacesService.getPublicProfile), so this
// page can't tell those two apart either.
export default function PublicExplorerProfilePage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const [profile, setProfile] = useState<PublicExplorerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicExplorerProfile(userId)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (!cancelled) {
          if (err instanceof HttpError && err.status === 404) setNotFound(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Explorer profile not found</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This profile doesn&apos;t exist, or its owner hasn&apos;t made it public.
        </p>
      </main>
    );
  }

  return (
    <main className="page-shell max-w-3xl">
      <PageHeader eyebrow="Explorer" title={profile.name} description="Places explored across Liberia." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="surface-card p-4 text-center">
          <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">{profile.progress.visitedPlacesCount}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Places visited</p>
        </div>
        <div className="surface-card p-4 text-center">
          <p className="text-3xl font-extrabold text-brand-700 dark:text-brand-300">
            {profile.progress.countiesVisited.length}
            <span className="text-lg text-slate-400">/{profile.progress.totalCounties}</span>
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Counties visited</p>
        </div>
      </div>

      <section className="surface-card p-5">
        <h2 className="page-title text-lg">Badges</h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {profile.progress.badges.map((badge) => (
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

      {profile.progress.countiesVisited.length > 0 && (
        <section className="surface-card p-5">
          <h2 className="page-title text-lg">Counties explored</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.progress.countiesVisited.map((county) => (
              <span key={county.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {county.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
