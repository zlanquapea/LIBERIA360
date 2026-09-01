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
const FEED_PAGE_SIZE = 20;
const PULL_TRIGGER_PX = 64;

function shuffleAds(items: Ad[], avoidFirstIds: string[] = []) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  if (
    shuffled.length > 1 &&
    shuffled[0] &&
    avoidFirstIds.includes(shuffled[0].id)
  ) {
    const swapIndex = shuffled.findIndex(
      (ad, index) => index > 0 && !avoidFirstIds.includes(ad.id),
    );
    if (swapIndex > 0) {
      [shuffled[0], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[0],
      ];
    }
  }
  return shuffled;
}

function samePostSet(current: CreatorPost[], next: CreatorPost[]) {
  if (current.length !== next.length) return false;
  const currentIds = new Set(current.map((post) => post.id));
  return next.every((post) => currentIds.has(post.id));
}

function varyRecentPosts(next: CreatorPost[], current: CreatorPost[]) {
  if (next.length < 2 || !samePostSet(current, next)) return next;
  const recentCount = Math.min(4, next.length);
  const offset = 1 + Math.floor(Math.random() * (recentCount - 1));
  return [
    ...next.slice(offset, recentCount),
    ...next.slice(0, offset),
    ...next.slice(recentCount),
  ];
}

function triggerRefreshHaptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(12);
  }
}

// Interaction note: preserve the existing sponsored-post card and organic-feed
// behavior while making manual refresh feel immediate, current, and lock-safe.
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
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= FEED_PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const refreshLockRef = useRef(false);
  const refreshFeedRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const pullDistanceRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

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
    getFollowedCreatorFeed(token, { page: 1, limit: FEED_PAGE_SIZE })
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

  async function refreshFeed() {
    if (refreshLockRef.current || loadingInitial) return;
    if (mode === "following" && !token) {
      setRefreshMessage("Log in to refresh the creators you follow.");
      return;
    }

    refreshLockRef.current = true;
    setRefreshing(true);
    pullDistanceRef.current = 0;
    setPullDistance(0);
    setError(null);
    setRefreshMessage(null);
    triggerRefreshHaptic();

    const previousAdIds = feedItems
      .filter((item) => item.kind === "ad")
      .map((item) => item.ad.id);
    const previousFirstAdId = previousAdIds[0] ?? null;
    const previousLastAdId = previousAdIds[previousAdIds.length - 1] ?? null;

    try {
      const postRequest =
        mode === "following"
          ? getFollowedCreatorFeed(token!, {
              page: 1,
              limit: FEED_PAGE_SIZE,
            })
          : getCreatorFeed({ page: 1, limit: FEED_PAGE_SIZE });
      const [postResult, refreshedAds] = await Promise.all([
        postRequest,
        mode === "discover"
          ? getActiveAdvertisements(20)
              .then((result) => result.map(advertisementToAd))
              .catch(() => ads)
          : Promise.resolve([] as Ad[]),
      ]);

      const nextPosts = varyRecentPosts(postResult.data, posts);
      const nextAds = shuffleAds(
        refreshedAds,
        [previousFirstAdId, previousLastAdId].filter(
          (adId): adId is string => Boolean(adId),
        ),
      );

      // Reset both the interval cadence and the ad cursor before the state
      // update so the next render starts a clean 4–6-post cycle.
      adSessionRef.current = createCreatorFeedAdSession();
      setPosts(nextPosts);
      setPage(1);
      setHasMore(1 < postResult.meta.totalPages);
      setAds(mode === "discover" ? nextAds : []);
      setRefreshMessage(
        samePostSet(posts, postResult.data)
          ? "No new posts yet — the feed was checked and sponsored rotation was refreshed."
          : "Feed refreshed with the latest creator posts.",
      );

    } catch {
      setError("The creator feed could not be refreshed. Please try again.");
    } finally {
      refreshLockRef.current = false;
      setRefreshing(false);
    }
  }

  useEffect(() => {
    refreshFeedRef.current = refreshFeed;
  });

  useEffect(() => {
    function handleWindowTouchStart(event: globalThis.TouchEvent) {
      if (refreshLockRef.current || window.scrollY > 0) return;
      const touch = event.touches[0];
      if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleWindowTouchMove(event: globalThis.TouchEvent) {
      const start = touchStartRef.current;
      const touch = event.touches[0];
      if (!start || !touch || refreshLockRef.current) return;
      if (window.scrollY > 0) {
        touchStartRef.current = null;
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        return;
      }
      event.preventDefault();
      const nextDistance = Math.min(96, deltaY * 0.55);
      pullDistanceRef.current = nextDistance;
      setPullDistance(nextDistance);
    }

    function handleWindowTouchEnd() {
      const shouldRefresh = pullDistanceRef.current >= PULL_TRIGGER_PX;
      touchStartRef.current = null;
      pullDistanceRef.current = 0;
      setPullDistance(0);
      if (shouldRefresh) void refreshFeedRef.current();
    }

    window.addEventListener("touchstart", handleWindowTouchStart, { passive: true });
    window.addEventListener("touchmove", handleWindowTouchMove, { passive: false });
    window.addEventListener("touchend", handleWindowTouchEnd);
    window.addEventListener("touchcancel", handleWindowTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleWindowTouchStart);
      window.removeEventListener("touchmove", handleWindowTouchMove);
      window.removeEventListener("touchend", handleWindowTouchEnd);
      window.removeEventListener("touchcancel", handleWindowTouchEnd);
    };
  }, []);

  async function loadMore() {
    if (loadingMore || !hasMore || refreshing) return;
    setLoadingMore(true);
    setError(null);
    try {
      const nextPage = page + 1;
      if (mode === "following" && !token) return;
      const result =
        mode === "following"
          ? await getFollowedCreatorFeed(token!, {
              page: nextPage,
              limit: FEED_PAGE_SIZE,
            })
          : await getCreatorFeed({ page: nextPage, limit: FEED_PAGE_SIZE });
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
      aria-busy={refreshing}
      className={`creator-feed-pull-shell ${showHeader ? "mt-8" : ""}`}
    >
      <div
        className={`creator-feed-refresh-indicator ${
          refreshing || pullDistance > 0 ? "is-visible" : ""
        } ${refreshing ? "is-refreshing" : ""}`}
        style={{ height: refreshing ? 52 : pullDistance > 0 ? pullDistance : 0 }}
        aria-live="polite"
      >
        <span>
          <ArrowPathIcon
            aria-hidden
            className={`creator-feed-refresh-icon ${refreshing ? "is-spinning" : ""}`}
            style={
              !refreshing && pullDistance > 0
                ? { transform: `rotate(${pullDistance * 3}deg)` }
                : undefined
            }
          />
          {refreshing
            ? "Refreshing creators…"
            : pullDistance >= PULL_TRIGGER_PX
              ? "Release to refresh"
              : "Pull to refresh"}
        </span>
      </div>

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

      {refreshMessage && (
        <p className="creator-feed-refresh-message" role="status">
          <ArrowPathIcon aria-hidden className="h-4 w-4" />
          {refreshMessage}
        </p>
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
          onClick={() => void loadMore()}
          disabled={loadingMore || refreshing}
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
