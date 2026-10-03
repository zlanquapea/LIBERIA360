"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MapPinIcon, ArrowUpRightIcon } from "@heroicons/react/24/outline";
import { parsePostListing } from "@/lib/post-listing";
import { getPlaceBySlug } from "@/lib/api";
import type { Place } from "@/lib/types";
import { SaveButton } from "./SaveButton";
import { AddToTripButton } from "./AddToTripButton";

export function PostListingCard({
  path,
  label,
}: {
  path: string;
  label?: string | null;
}) {
  const listing = parsePostListing(path);
  const [place, setPlace] = useState<Place | null>(null);
  const slug = listing?.kind === "places" ? listing.slug : null;
  useEffect(() => {
    let cancelled = false;
    setPlace(null);
    if (slug)
      getPlaceBySlug(slug)
        .then((result) => {
          if (!cancelled) setPlace(result);
        })
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);
  if (!listing) return null;
  const title =
    place?.name || label?.trim() || listing.slug.replace(/[-_]/g, " ");
  return (
    <aside
      aria-label="Tagged listing"
      className="mx-4 mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50 sm:mx-5"
    >
      <Link href={listing.path} className="flex min-h-11 items-center gap-3">
        <MapPinIcon
          aria-hidden
          className="h-6 w-6 shrink-0 text-brand-600 dark:text-emerald-300"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            {listing.label}
          </span>
          <span className="block break-words font-semibold">{title}</span>
          <span className="text-sm text-brand-700 dark:text-emerald-300">
            {listing.action}
          </span>
        </span>
        <ArrowUpRightIcon aria-hidden className="h-5 w-5 shrink-0" />
      </Link>
      {place && (
        <div className="mt-3 flex flex-wrap gap-2">
          <SaveButton slug={place.slug} placeId={place.id} />
          <AddToTripButton
            contentType="place"
            itemId={place.id}
            itemName={place.name}
          />
        </div>
      )}
    </aside>
  );
}
