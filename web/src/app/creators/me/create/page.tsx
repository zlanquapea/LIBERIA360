"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/hooks/useAuth";
import { getMyCreatorProfile } from "@/lib/creator-api";
import type { Creator } from "@/lib/types";
import { CreatorPostComposer } from "@/components/CreatorPostComposer";

export default function CreateCreatorPostPage() {
  const { user, token, ready } = useAuth();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getMyCreatorProfile(token)
      .then((profile) => {
        if (!cancelled) setCreator(profile);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  if (!ready || loading) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-3 px-4 py-10">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading post editor…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
          <PencilSquareIcon aria-hidden className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
          Create a creator post
        </h1>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
          Log in as a creator to share a text post, photo, or video with the LIBERIA360 community.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12 text-center">
        <h1 className="font-display text-xl font-bold text-slate-950 dark:text-white">
          We couldn’t open the post editor
        </h1>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
          Please try again. Your account and existing posts have not been changed.
        </p>
        <Link
          href="/creators"
          className="mx-auto inline-flex min-h-11 items-center rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-brand-700 hover:border-brand-500 dark:border-slate-700 dark:text-brand-300"
        >
          Back to creators
        </Link>
      </main>
    );
  }

  if (!creator) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-12 text-center">
        <h1 className="font-display text-xl font-bold text-slate-950 dark:text-white">
          Creator profile required
        </h1>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
          Set up your creator profile before publishing to the creator feed.
        </p>
        <Link
          href="/creators/me"
          className="mx-auto inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Set up creator profile
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5 pb-12 sm:py-8">
      <header className="flex items-center gap-3">
        <Link
          href="/creators/me"
          aria-label="Back to creator dashboard"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-700 hover:border-brand-400 hover:text-brand-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
        >
          <ArrowLeftIcon aria-hidden className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            Creator studio
          </p>
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Create post
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm leading-6 text-brand-950 dark:border-brand-900/60 dark:bg-brand-950/20 dark:text-brand-100">
        Share a thought, photo, or video. Your post will appear in the creator feed after you publish it.
      </div>

      <CreatorPostComposer
        token={token}
        onPublished={() => {
          window.location.href = "/creators?posted=1";
        }}
      />
    </main>
  );
}
