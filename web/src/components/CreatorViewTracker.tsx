"use client";

import { useEffect } from "react";
import { recordCreatorAnalyticsEvent } from "@/lib/analytics-api";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { resolveImageUrl } from "@/lib/images";
import type { Creator } from "@/lib/types";

// Creator-profile equivalent of PlaceViewTracker — fires the "view" event
// once per page load. Same reasoning: the public creator profile is a
// server component, so a page view can't be recorded from there directly.
export function CreatorViewTracker({
  creator,
}: {
  creator: Pick<
    Creator,
    "id" | "username" | "name" | "profileImage" | "category" | "county"
  >;
}) {
  useEffect(() => {
    recordCreatorAnalyticsEvent(creator.id, "view");
    addRecentlyViewed({
      id: creator.id,
      kind: "creator",
      href: `/creators/${creator.username}`,
      title: creator.name,
      subtitle: creator.county?.name ?? creator.category,
      imageUrl: creator.profileImage
        ? resolveImageUrl(creator.profileImage)
        : null,
    });
  }, [creator]);

  return null;
}
