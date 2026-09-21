'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BriefcaseIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { addItineraryStop, getMyItineraries, getSharedWithMe } from '@/lib/itinerary-api';
import { setEventRsvp } from '@/lib/event-api';
import { HttpError } from '@/lib/http';
import type { Itinerary } from '@/lib/types';

type AddToTripButtonProps =
  | { contentType: 'event'; itemId: string; itemName: string }
  | { contentType: 'carListing'; itemId: string; itemName: string }
  | { contentType: 'place'; itemId: string; itemName: string };

// Lets someone planning a trip add an event, a rental car, or a place
// (including a hotel — AddTripStop's "Stay" tab is this exact same catalog,
// just entered from the other direction) straight from that item's own
// page — the same "add this to my trip" impulse AddTripStop already serves
// inline on the trip page (Sep 2026, "make trip planning the platform's
// focus" product review). Mirrors ShareMenu's own click-to-open dropdown
// shape rather than a modal — a short, low-stakes picklist doesn't need a
// full overlay.
export function AddToTripButton(props: AddToTripButtonProps) {
  const { contentType, itemId, itemName } = props;
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<Itinerary[] | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Itinerary | null>(null);
  const [day, setDay] = useState(1);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedTo, setAddedTo] = useState<Itinerary | null>(null);

  async function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setError(null);
    setAddedTo(null);
    setSelectedTrip(null);
    if (trips || !token) return;
    setLoading(true);
    try {
      const [mine, shared] = await Promise.all([
        getMyItineraries(token),
        getSharedWithMe(token),
      ]);
      setTrips([...mine, ...shared].filter((trip) => !trip.cancelledAt));
    } catch {
      setError('Could not load your trips.');
    } finally {
      setLoading(false);
    }
  }

  function pickTrip(trip: Itinerary) {
    setSelectedTrip(trip);
    setDay(1);
    setError(null);
  }

  async function confirmAdd() {
    if (!token || !selectedTrip) return;
    setAdding(true);
    setError(null);
    try {
      const input =
        contentType === 'event'
          ? { eventId: itemId, day }
          : contentType === 'carListing'
            ? { carListingId: itemId, day }
            : { placeId: itemId, day };
      await addItineraryStop(token, selectedTrip.id, input);
      if (contentType === 'event') {
        // Best-effort — a planned event should also show up in the
        // traveler's own Interested/Going status. Never blocks the
        // "added to trip" success state on this succeeding.
        setEventRsvp(token, itemId, 'interested').catch(() => undefined);
      }
      setAddedTo(selectedTrip);
      setSelectedTrip(null);
    } catch (err) {
      setError(
        err instanceof HttpError
          ? err.message
          : `Could not add this ${contentType === 'event' ? 'event' : contentType === 'carListing' ? 'car' : 'place'} to the trip.`,
      );
    } finally {
      setAdding(false);
    }
  }

  if (!token) {
    return (
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
      >
        <BriefcaseIcon aria-hidden className="h-4 w-4" />
        Add to trip
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={toggleOpen}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
      >
        <BriefcaseIcon aria-hidden className="h-4 w-4" />
        Add to trip
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Add to trip"
          className="absolute right-0 top-[3.25rem] z-[100] w-72 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          {addedTo ? (
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckIcon aria-hidden className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium">
                Added to Day {day} of &ldquo;{addedTo.title}&rdquo;
              </p>
              <Link
                href={`/trips/${addedTo.id}`}
                className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                onClick={() => setOpen(false)}
              >
                View trip
              </Link>
            </div>
          ) : selectedTrip ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <p className="truncate text-sm font-semibold">{selectedTrip.title}</p>
                <button
                  type="button"
                  onClick={() => setSelectedTrip(null)}
                  className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Change trip
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                Day
                <select
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-brand-500"
                >
                  {Array.from({ length: selectedTrip.durationDays }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d}
                    </option>
                  ))}
                </select>
              </label>
              {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
              <button
                type="button"
                disabled={adding}
                onClick={confirmAdd}
                className="rounded-full bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
              >
                {adding ? 'Adding…' : `Add ${itemName} to Day ${day}`}
              </button>
            </div>
          ) : loading ? (
            <p className="px-1 py-3 text-center text-sm text-slate-400">Loading your trips…</p>
          ) : error ? (
            <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>
          ) : !trips || trips.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
              <p>You have no trips yet.</p>
              <Link
                href="/trips/new"
                className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
              >
                Plan a trip
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {trips.map((trip) => (
                <li key={trip.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => pickTrip(trip)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <span className="truncate">{trip.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {trip.durationDays} day{trip.durationDays === 1 ? '' : 's'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
