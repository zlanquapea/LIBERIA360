'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ApiError, getPlaceBySlug } from '@/lib/api';
import { CreatorPostCard } from '@/components/CreatorPostCard';
import { PlaceCard } from '@/components/PlaceCard';
import { BrandLoader } from '@/components/BrandLoader';
import { useAuth } from '@/hooks/useAuth';
import { useSavedPlaces } from '@/hooks/useSavedPlaces';
import { getSavedCreatorPosts, toggleCreatorPostSave } from '@/lib/creator-feed-api';
import { cachePlaceSnapshot, getCachedPlaceSnapshot } from '@/lib/saved-places';
import type { CreatorPost, Place } from '@/lib/types';

interface ResolvedPlace {
  place: Place;
  offline: boolean;
}

function SavedPostsSection() {
  const { token, ready } = useAuth();
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      setPosts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getSavedCreatorPosts(token)
      .then((result) => {
        if (!cancelled) setPosts(result);
      })
      .catch(() => {
        if (!cancelled) setError('Saved posts could not be loaded. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  async function unsavePost(postId: string) {
    if (!token) return;
    await toggleCreatorPostSave(token, postId);
    setPosts((current) => current.filter((post) => post.id !== postId));
  }

  return (
    <section aria-labelledby="saved-posts-heading" className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
          Your collection
        </p>
        <h2 id="saved-posts-heading" className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">
          Saved posts
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Keep creator stories here so you can return to them later.
        </p>
      </div>

      {!ready || loading ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <BrandLoader />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading saved posts…</p>
        </div>
      ) : !token ? (
        <div className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-white">Sign in to save creator posts.</p>
          <Link href="/login" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
            Log in
          </Link>
        </div>
      ) : error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : posts.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 px-5 py-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nothing saved yet. Tap the bookmark on a creator post to keep it here.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {posts.map((post) => (
            <CreatorPostCard key={post.id} post={post} onUnsave={unsavePost} />
          ))}
        </div>
      )}
    </section>
  );
}

// Saved / Bucket List screen (Tech Spec §4.1) — reads the device-local
// saved-slugs list and resolves each into full place data from the API.
// Offline-capable (§6.3): a place that fails to load for any reason other
// than a 404 (removed from the catalog) falls back to the last snapshot
// cached the previous time it loaded successfully — see lib/saved-places.ts.
export default function SavedPage() {
  const { savedSlugs } = useSavedPlaces();
  const [resolved, setResolved] = useState<ResolvedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (savedSlugs.length === 0) {
      setResolved([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(
      savedSlugs.map(async (slug): Promise<ResolvedPlace | null> => {
        try {
          const place = await getPlaceBySlug(slug);
          cachePlaceSnapshot(place);
          return { place, offline: false };
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null;
          const cached = getCachedPlaceSnapshot(slug);
          return cached ? { place: cached.place, offline: true } : null;
        }
      }),
    ).then((results) => {
      if (!cancelled) {
        setResolved(results.filter((r): r is ResolvedPlace => r !== null));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [savedSlugs]);

  const anyOffline = resolved.some((r) => r.offline);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-10">
      <SavedPostsSection />

      <section aria-labelledby="saved-places-heading" className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            Your collection
          </p>
          <h1 id="saved-places-heading" className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">
            Saved places
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Stored on this device — no account needed.</p>
        </div>

        {anyOffline && (
          <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            You&apos;re offline — showing the last saved copy for some places. Details may be out of date.
          </p>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
            <BrandLoader />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Loading saved places…</p>
          </div>
        ) : resolved.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
            Nothing saved yet — tap “Save” on a destination profile to add it here.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {resolved.map(({ place, offline }, i) => (
              <div key={place.id} className="relative">
                {offline && (
                  <span className="absolute right-2 top-2 z-10 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-medium text-white">
                    Offline copy
                  </span>
                )}
                <PlaceCard place={place} index={i} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
