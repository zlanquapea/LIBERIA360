"use client";

import { useEffect } from "react";
import { recordEventAnalyticsEvent } from "@/lib/analytics-api";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { resolveImageUrl } from "@/lib/images";
import type { Event } from "@/lib/types";

// Also fires the "view" analytics event once per page load — mirrors
// PlaceViewTracker. Was previously only updating "recently viewed",
// leaving the organizer's own event with no view count at all (see
// getEventAnalytics / My Events' metrics panel).
export function EventViewTracker({
  event,
}: {
  event: Pick<Event, "id" | "name" | "images" | "locationText" | "county">;
}) {
  useEffect(() => {
    recordEventAnalyticsEvent(event.id, "view");
    addRecentlyViewed({
      id: event.id,
      kind: "event",
      href: `/events/${event.id}`,
      title: event.name,
      subtitle: event.locationText || `${event.county.name} County`,
      imageUrl: event.images[0] ? resolveImageUrl(event.images[0]) : null,
    });
  }, [event]);

  return null;
}
