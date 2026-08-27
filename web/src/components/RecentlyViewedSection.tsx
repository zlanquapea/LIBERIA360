"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { SafeImage } from "./SafeImage";
import {
  clearRecentlyViewed,
  getRecentlyViewed,
  subscribeToRecentlyViewed,
  type RecentlyViewedItem,
} from "@/lib/recently-viewed";

const KIND_LABELS = {
  place: "Place",
  creator: "Creator",
  event: "Event",
} as const;

export function RecentlyViewedSection() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(getRecentlyViewed());
    refresh();
    setHydrated(true);
    return subscribeToRecentlyViewed(refresh);
  }, []);

  if (!hydrated || items.length === 0) return null;

  return (
    <section
      aria-labelledby="recently-viewed-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">
            On this device
          </p>
          <h2
            id="recently-viewed-heading"
            className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50"
          >
            Recently viewed
          </h2>
        </div>
        <button
          type="button"
          onClick={() => clearRecentlyViewed()}
          className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          <XMarkIcon aria-hidden className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {items.map((item) => (
          <Link
            key={`${item.kind}-${item.id}`}
            href={item.href}
            className="flex w-48 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors hover:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-24 w-full bg-gradient-to-br from-brand-800 to-brand-600">
              <SafeImage
                src={item.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                fallback={
                  <div
                    aria-hidden
                    className="flex h-full w-full items-center justify-center text-xs font-semibold text-white/80"
                  >
                    {KIND_LABELS[item.kind]}
                  </div>
                }
              />
            </div>
            <div className="flex min-h-20 flex-col gap-1 p-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-700 dark:text-brand-300">
                {KIND_LABELS[item.kind]}
              </span>
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                {item.title}
              </p>
              {item.subtitle && (
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {item.subtitle}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Stored on this device only.
      </p>
    </section>
  );
}
