"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recently-viewed";
import { resolveImageUrl } from "@/lib/images";
import type { Event } from "@/lib/types";

export function EventViewTracker({
  event,
}: {
  event: Pick<Event, "id" | "name" | "images" | "locationText" | "county">;
}) {
  useEffect(() => {
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
