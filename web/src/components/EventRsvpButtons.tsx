"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircleIcon,
  StarIcon,
} from "@heroicons/react/24/outline";
import {
  CheckCircleIcon as CheckCircleSolidIcon,
  StarIcon as StarSolidIcon,
} from "@heroicons/react/24/solid";
import { useAuth } from "@/hooks/useAuth";
import { HttpError } from "@/lib/http";
import { getEventRsvp, removeEventRsvp, setEventRsvp } from "@/lib/event-api";
import type { EventRsvpStatus } from "@/lib/types";

const BUTTON_CLASS =
  "flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800";

// Facebook's Interested/Going toggle — real backend RSVP tracking (see
// EventsService.setRsvp) rather than Facebook's exact button chrome,
// reusing this app's own plain icon+label feed-action recipe (same shape
// as CreatorPostCard's Like button) rather than a filled pill. "feed"
// shows Interested only — a card already has Share alongside it, and two
// full RSVP buttons plus Share crowd a card the way the creator feed's own
// action row avoids; "detail" shows both, matching the single-event
// page's extra room.
export function EventRsvpButtons({
  eventId,
  initialStatus,
  initialInterestedCount,
  initialGoingCount,
  variant,
  hydrateFromServer = false,
}: {
  eventId: string;
  initialStatus: EventRsvpStatus | null;
  initialInterestedCount: number;
  initialGoingCount: number;
  variant: "feed" | "detail";
  // The public Event shape carries no per-viewer RSVP status (see
  // EventRsvpState's doc comment in shared-types), so `initialStatus` is
  // always null on first render. The single-event page (one request) sets
  // this to fetch the viewer's real status once a token is available;
  // the feed page leaves it off — hydrating every card in a scrolling list
  // would be one request per card for a state that only matters once
  // someone actually taps a button.
  hydrateFromServer?: boolean;
}) {
  const { token } = useAuth();
  const [status, setStatus] = useState<EventRsvpStatus | null>(initialStatus);
  const [interestedCount, setInterestedCount] = useState(initialInterestedCount);
  const [goingCount, setGoingCount] = useState(initialGoingCount);
  const [busy, setBusy] = useState<EventRsvpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrateFromServer || !token) return;
    let cancelled = false;
    getEventRsvp(token, eventId).then((result) => {
      if (!cancelled) setStatus(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateFromServer, token, eventId]);

  async function toggle(target: EventRsvpStatus) {
    if (!token || busy) return;
    setBusy(target);
    setError(null);
    const previousStatus = status;
    const wasSet = previousStatus === target;

    try {
      if (wasSet) {
        setStatus(null);
        const result = await removeEventRsvp(token, eventId);
        setInterestedCount(result.interestedCount);
        setGoingCount(result.goingCount);
      } else {
        setStatus(target);
        const result = await setEventRsvp(token, eventId, target);
        setInterestedCount(result.interestedCount);
        setGoingCount(result.goingCount);
      }
    } catch (err) {
      setStatus(previousStatus);
      setError(
        err instanceof HttpError
          ? err.message
          : "Your RSVP could not be updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  const interestedActive = status === "interested";
  const goingActive = status === "going";

  if (!token) {
    return (
      <div className="flex gap-1">
        <Link href="/login" className={`${BUTTON_CLASS} text-slate-600 dark:text-slate-300`}>
          <StarIcon aria-hidden className="h-5 w-5" />
          <span className="truncate">Interested</span>
        </Link>
        {variant === "detail" && (
          <Link href="/login" className={`${BUTTON_CLASS} text-slate-600 dark:text-slate-300`}>
            <CheckCircleIcon aria-hidden className="h-5 w-5" />
            <span className="truncate">Going</span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => toggle("interested")}
          disabled={busy !== null}
          aria-pressed={interestedActive}
          className={`${BUTTON_CLASS} ${interestedActive ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"}`}
        >
          {interestedActive ? (
            <StarSolidIcon aria-hidden className="h-5 w-5" />
          ) : (
            <StarIcon aria-hidden className="h-5 w-5" />
          )}
          <span className="truncate">Interested{interestedCount > 0 ? ` (${interestedCount})` : ""}</span>
        </button>
        {variant === "detail" && (
          <button
            type="button"
            onClick={() => toggle("going")}
            disabled={busy !== null}
            aria-pressed={goingActive}
            className={`${BUTTON_CLASS} ${goingActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-slate-300"}`}
          >
            {goingActive ? (
              <CheckCircleSolidIcon aria-hidden className="h-5 w-5" />
            ) : (
              <CheckCircleIcon aria-hidden className="h-5 w-5" />
            )}
            <span className="truncate">Going{goingCount > 0 ? ` (${goingCount})` : ""}</span>
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
