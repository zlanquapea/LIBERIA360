'use client';

import type { GenerateTripInput } from './itinerary-api';

// Guest-first trip planning (product review readout, Aug 22, 2026): a
// visitor with no account can already see a full generated route via
// TripPlannerForm's preview. When they click "Log in to save this trip",
// we stash the exact inputs that produced it here before sending them to
// /login — sessionStorage, not localStorage, because this is a one-time
// handoff across a single redirect, not a durable preference. Once they're
// back on /trips/new authenticated, the form re-runs the same inputs
// through the real save endpoint and clears this immediately, so a stale
// draft can never resurrect itself on a later, unrelated visit.
const STORAGE_KEY = 'liberia360:pending-trip-draft';

export function savePendingTripDraft(input: GenerateTripInput): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  } catch {
    // Best-effort — if storage is unavailable, the guest just lands back on
    // a blank planner after logging in instead of an auto-saved trip.
  }
}

export function takePendingTripDraft(): GenerateTripInput | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as GenerateTripInput;
    return parsed && typeof parsed.durationDays === 'number' ? parsed : null;
  } catch {
    return null;
  }
}
