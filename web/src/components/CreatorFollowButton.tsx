"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserPlusIcon, UserMinusIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { HttpError } from "@/lib/http";
import {
  getCreatorFollowState,
  toggleCreatorFollow,
} from "@/lib/creator-follow-api";

interface CreatorFollowButtonProps {
  creatorId: string;
  initialFollowerCount?: number;
  compact?: boolean;
  /** Hide the control once the viewer is already following; profiles keep the toggle. */
  hideWhenFollowing?: boolean;
}

export function CreatorFollowButton({
  creatorId,
  initialFollowerCount = 0,
  compact = false,
  hideWhenFollowing = false,
}: CreatorFollowButtonProps) {
  const { token, ready } = useAuth();
  const [following, setFollowing] = useState(false);
  const [canFollow, setCanFollow] = useState(true);
  const [followStateLoaded, setFollowStateLoaded] = useState(false);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    setFollowStateLoaded(false);
    if (!token) {
      setFollowStateLoaded(true);
      return;
    }
    let cancelled = false;
    getCreatorFollowState(token, creatorId)
      .then((state) => {
        if (cancelled) return;
        setFollowing(state.following);
        setCanFollow(state.canFollow);
        setFollowerCount(state.followerCount);
        setFollowStateLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof HttpError
            ? err.message
            : "Follow status could not be loaded.",
        );
        setFollowStateLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [creatorId, ready, token]);

  async function handleToggle() {
    if (!token || loading || !canFollow) return;
    setLoading(true);
    setError(null);
    try {
      const state = await toggleCreatorFollow(token, creatorId);
      setFollowing(state.following);
      setCanFollow(state.canFollow);
      setFollowerCount(state.followerCount);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : "Follow status could not be updated.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Link
        href="/login"
        className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-brand-200 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-900 dark:text-brand-300 dark:hover:bg-brand-950/30 ${compact ? "w-auto" : "w-full"}`}
      >
        <UserPlusIcon aria-hidden className="h-4 w-4" />
        Follow
      </Link>
    );
  }

  if (!canFollow && !loading) return null;
  if (hideWhenFollowing && token && (!followStateLoaded || following))
    return null;

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading || !canFollow}
        aria-pressed={following}
        className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-60 ${following ? "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" : "border-brand-200 text-brand-700 hover:bg-brand-50 dark:border-brand-900 dark:text-brand-300 dark:hover:bg-brand-950/30"} ${compact ? "w-auto" : "w-full"}`}
      >
        {following ? (
          <UserMinusIcon aria-hidden className="h-4 w-4" />
        ) : (
          <UserPlusIcon aria-hidden className="h-4 w-4" />
        )}
        {loading ? "Updating…" : following ? "Following" : "Follow"}
      </button>
      <span className="sr-only">
        {followerCount.toLocaleString()} followers
      </span>
      {error && (
        <span
          role="alert"
          className="text-[11px] text-rose-700 dark:text-rose-300"
        >
          {error}
        </span>
      )}
    </div>
  );
}
