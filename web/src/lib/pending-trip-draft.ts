'use client';

import type { CreateTripInput } from './itinerary-api';
import type { Place } from './types';

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

// The full destination Place rides along too (Aug 2026 social-trip spec) —
// CreateTripInput only carries destinationPlaceId, but DestinationAutocomplete
// needs the whole Place object back to re-render the selected destination
// once the form resumes after login.
export type PendingTripDraft = CreateTripInput & { destination: Place };

export function savePendingTripDraft(input: PendingTripDraft): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(input));
  } catch {
    // Best-effort — if storage is unavailable, the guest just lands back on
    // a blank planner after logging in instead of an auto-saved trip.
  }
}

export function takePendingTripDraft(): PendingTripDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as PendingTripDraft;
    return parsed && typeof parsed.startDate === 'string' && parsed.destination
      ? parsed
      : null;
  } catch {
    return null;
  }
}
