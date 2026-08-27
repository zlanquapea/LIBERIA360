'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getMyCreatorProfile } from '@/lib/creator-api';
import { useAuth } from '@/hooks/useAuth';

type CreatorState = 'pending' | 'creator' | 'traveler';

export function CreatorDirectoryHeader() {
  const { token, ready } = useAuth();
  const [creatorState, setCreatorState] = useState<CreatorState>('pending');

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setCreatorState('traveler');
      return;
    }

    let cancelled = false;
    setCreatorState('pending');
    getMyCreatorProfile(token)
      .then((creator) => {
        if (!cancelled) setCreatorState(creator ? 'creator' : 'traveler');
      })
      .catch(() => {
        // Do not show a creator-acquisition CTA on an uncertain authenticated
        // state; the safe fallback is to keep the header compact.
        if (!cancelled) setCreatorState('pending');
      });

    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">LIBERIA360 community</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">Creators</h1>
      </div>
      {creatorState === 'traveler' && (
        <Link
          href="/creators/me"
          className="shrink-0 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
        >
          Become a creator
        </Link>
      )}
    </div>
  );
}
