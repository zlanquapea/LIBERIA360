import type { CSSProperties } from 'react';

// Shared by every discovery card (PlaceCard, BusinessCard, EventFeedCard,
// CreatorCard, CarListingCard, PlaceCardCompact) so a grid/list's cards
// fade-and-lift into place one after another instead of all popping in at
// once — pair with the `animate-fade-in-up` class (tailwind.config.ts).
// Capped so a long list's last few cards don't sit waiting a full second
// for their turn; anything past the cap just joins in with the last
// visible batch.
const STEP_MS = 45;
const MAX_STEPS = 8;

export function staggerDelay(index: number): CSSProperties {
  return { animationDelay: `${Math.min(index, MAX_STEPS) * STEP_MS}ms` };
}
