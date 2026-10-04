'use client';

import type { Event } from '@/lib/types';
import { EventTicket } from './EventTicket';

// One ticket in the "Happening soon" / "Featured events" shelves — see
// EventTicket for the design.
export function EventCard({ event, cardRef }: { event: Event; cardRef?: (el: HTMLDivElement | null) => void }) {
  return <EventTicket event={event} variant="shelf" cardRef={cardRef} testId="upcoming-event-card" />;
}
