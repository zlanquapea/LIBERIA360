"use client";

import { useEffect } from "react";
import { recordAnalyticsEvent } from "@/lib/analytics-api";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { resolveImageUrl } from "@/lib/images";
import type { Place } from "@/lib/types";

// Fires the "view" analytics event once per page load (Tech Spec §3.3
// business analytics / §8.4 B2B analytics). Renders nothing — the
// Destination Profile itself is a server component, so a page view can't
// be recorded from there directly.
export function PlaceViewTracker({
  place,
}: {
  place: Pick<Place, "id" | "slug" | "name" | "city" | "county" | "images">;
}) {
  useEffect(() => {
    recordAnalyticsEvent(place.id, "view");
    addRecentlyViewed({
      id: place.id,
      kind: "place",
      href: `/places/${place.slug}`,
      title: place.name,
      subtitle: `${place.city}, ${place.county.name}`,
      imageUrl: place.images[0] ? resolveImageUrl(place.images[0]) : null,
    });
  }, [place]);

  return null;
}
