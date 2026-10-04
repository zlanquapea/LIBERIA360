"use client";

import type { Event } from "@/lib/types";
import { EventTicket } from "./EventTicket";

// One ticket in the Events listing — see EventTicket for the design. On
// wider screens it turns sideways, poster on the left.
export function EventFeedCard({ event, index }: { event: Event; index?: number }) {
  return <EventTicket event={event} variant="feed" index={index} testId="event-feed-card" />;
}
