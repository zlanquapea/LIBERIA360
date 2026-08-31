"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { getCreatorFeed, getFollowedCreatorFeed } from "@/lib/creator-feed-api";
import { getActiveAdvertisements } from "@/lib/api";
import { advertisementToAd } from "@/lib/ad-mapping";
import {
  createCreatorFeedAdSession,
  mergeCreatorPostsWithAds,
} from "@/lib/creator-feed-ads";
import type { Ad, CreatorPost } from "@/lib/types";
import { CreatorPostCard } from "./CreatorPostCard";
import { SponsoredCreatorAdCard } from "./SponsoredCreatorAdCard";

type CreatorFeedMode = "discover" | "following";

export function CreatorFeed({
  initialPosts,
  showHeader = true,
  mode = "discover",
}: {
  initialPosts: CreatorPost[];
  showHeader?: boolean;
  mode?: CreatorFeedMode;
}) {
  const { token, ready } = useAuth();
  const [posts, setPosts] = useState(initialPosts);
  const [ads, setAds] = useState<Ad[]>([]);
  const adSessionRef = useRef(createCreatorFeedAdSession());
  const [page, setPage] = useState(1);
  const [loadingInitial, setLoadingInitial] = useState(mode === "following");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [error, setError] = useState<string | null>(null);
  const feedItems = useMemo(
    () =>
      mergeCreatorPostsWithAds(
        posts,
        mode === "discover" ? ads : [],
        adSessionRef.current,
      ),
    [ads, mode, posts],
  );

  useEffect(() => {
    if (mode !== "discover") return;
    let cancelled = false;
    getActiveAdvertisements(20)
      .then((result) => {
        if (!cancelled) setAds(result.map(advertisementToAd));
      })
      .catch(() => {
        // Ads are optional feed content; organic posts remain available.
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== "following" || !ready) return;
    if (!token) {
      setLoadingInitial(false);
      return;
    }
    let cancelled = false;
    setLoadingInitial(true);
    setError(null);
    getFollowedCreatorFeed(token, { page: 1, limit: 20 })
      .then((result) => {
        if (cancelled) return;
        setPosts(result.data);
        setPage(1);
        setHasMore(1 < result.meta.totalPages);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Your followed creator posts could not be loaded. Please try again.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, ready, token]);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      if (mode === "following" && !token) return;
      const result =
        mode === "following"
          ? await getFollowedCreatorFeed(token!, { page: nextPage, limit: 20 })
          : await getCreatorFeed({ page: nextPage, limit: 20 });
      setPosts((current) => [...current, ...result.data]);
      setPage(nextPage);
      setHasMore(nextPage < result.meta.totalPages);
    } catch {
      setError("More creator posts could not be loaded. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      aria-labelledby={showHeader ? "creator-feed-heading" : undefined}
      aria-label={showHeader ? undefined : "Creator feed"}
      className={showHeader ? "mt-8" : ""}
    >
      {showHeader && (
        <div className="mb-4">
          <h2
            id="creator-feed-heading"
            className="font-display text-lg font-bold text-slate-950 dark:text-slate-50"
          >
            {mode === "following"
              ? "Latest from creators you follow"
              : "Real stories from Liberia's creators"}
          </h2>
        </div>
      )}

      {loadingInitial ? (
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading your followed creators…
          </p>
        </div>
      ) : posts.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {feedItems.map((item, index) =>
            item.kind === "ad" ? (
              <SponsoredCreatorAdCard
                key={`ad-${item.ad.id}-${index}`}
                ad={item.ad}
              />
            ) : (
              <CreatorPostCard key={item.post.id} post={item.post} />
            ),
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {mode === "following"
              ? token
                ? "Your following feed is empty."
                : "Log in to see your following feed."
              : "The creator feed is ready."}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
            {mode === "following" ? (
              token ? (
                <>
                  Follow creators from{" "}
                  <Link
                    href="/creators"
                    className="font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Discover
                  </Link>{" "}
                  to build this feed.
                </>
              ) : (
                <>Sign in to see posts from creators you follow.</>
              )
            ) : (
              "Creators can share a photo or video with a caption, and travelers can like, comment, save, and share it here."
            )}
          </p>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 text-sm text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      )}
      {hasMore && posts.length > 0 && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mx-auto mt-6 flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-brand-800 hover:border-brand-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-200"
        >
          {loadingMore && (
            <ArrowPathIcon aria-hidden className="h-4 w-4 animate-spin" />
          )}
          {loadingMore ? "Loading…" : "Load more posts"}
        </button>
      )}
    </section>
  );
}
