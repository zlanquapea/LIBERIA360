'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { deleteEvent, getMyEvents } from '@/lib/event-api';
import { getCounties } from '@/lib/api';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { formatEventCategory, formatEventDateRange, formatEventReviewStatus } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { NewEventForm } from '@/components/NewEventForm';
import { SafeImage } from '@/components/SafeImage';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { SuccessBanner } from '@/components/SuccessBanner';
import type { County, Event, EventReviewStatus } from '@/lib/types';

const STATUS_BADGE: Record<EventReviewStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

// "My Events" — everything an organizer has posted, regardless of date
// (GET /events/mine, unlike the public listing, includes past events too
// so someone can see what they've already run), mirroring the "My
// Places"/"My Trips" pattern already used elsewhere in the account area.
export default function MyEventsPage() {
  const { user, token, ready } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [counties, setCounties] = useState<County[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [pendingCancel, setPendingCancel] = useState<Event | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!token) return;
    getMyEvents(token)
      .then(setEvents)
      .catch((err) => setLoadError(getFriendlyErrorMessage(err, { context: { action: 'load-my-events' } })))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    getCounties().then(setCounties);
  }, []);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    reload();
  }, [ready, token, reload]);

  useEffect(() => {
    if (!successMessage) return;
    const id = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(id);
  }, [successMessage]);

  async function confirmCancel() {
    if (!token || !pendingCancel) return;
    const target = pendingCancel;
    setActionLoading(true);
    setDialogError(null);
    try {
      await deleteEvent(token, target.id);
      setEvents((prev) => prev.filter((e) => e.id !== target.id));
      setPendingCancel(null);
      setSuccessMessage(`"${target.name}" was cancelled.`);
    } catch (err) {
      if (isNotFoundError(err)) {
        setEvents((prev) => prev.filter((e) => e.id !== target.id));
        setPendingCancel(null);
        setSuccessMessage('This event was already removed.');
      } else {
        setDialogError(getFriendlyErrorMessage(err, { context: { action: 'cancel-event', eventId: target.id } }));
      }
    } finally {
      setActionLoading(false);
    }
  }

  if (!ready || loading) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Events</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to see events you&apos;ve posted.</p>
        <Link
          href="/login"
          className="mx-auto rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Log in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Events</h1>
        <Link
          href="/events/new"
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + Post an event
        </Link>
      </div>

      {successMessage && <SuccessBanner>{successMessage}</SuccessBanner>}

      {loadError && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {loadError}
        </p>
      )}

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          You haven&apos;t posted any events yet.{' '}
          <Link href="/events/new" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Post your first one
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => {
            const isPast = new Date(event.startDate) < new Date();
            return (
              <li key={event.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-start gap-3">
                  {event.images[0] && (
                    <SafeImage
                      src={resolveImageUrl(event.images[0])}
                      alt={event.name}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      fallback={<div aria-hidden className="h-16 w-16 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/events/${event.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-50">
                        {event.name}
                      </Link>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[event.reviewStatus]}`}>
                        {formatEventReviewStatus(event.reviewStatus)}
                      </span>
                      {isPast && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Past
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatEventCategory(event.category)} · {formatEventDateRange(event.startDate, event.endDate)}
                    </p>
                    {event.reviewStatus === 'pending' && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">Awaiting admin review — it won&apos;t be shown until approved.</p>
                    )}
                    {event.reviewStatus === 'rejected' && (
                      <p className="text-xs text-flag-700 dark:text-flag-300">
                        This event was rejected{event.rejectionReason ? `: ${event.rejectionReason}` : '.'}
                      </p>
                    )}
                  </div>
                </div>

                {editingId === event.id ? (
                  <NewEventForm
                    counties={counties}
                    event={event}
                    onSaved={(updated) => {
                      setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingId(event.id)}
                      className="self-start text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingCancel(event)}
                      className="self-start text-xs font-medium text-flag-700 dark:text-flag-300 hover:underline"
                    >
                      Cancel event
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingCancel != null}
        title={pendingCancel ? `Cancel "${pendingCancel.name}"?` : 'Cancel this event?'}
        description="This removes the event listing for everyone. Anyone who was planning around it won't be notified."
        confirmLabel="Cancel Event"
        loadingLabel="Cancelling…"
        isLoading={actionLoading}
        error={dialogError}
        onConfirm={confirmCancel}
        onCancel={() => {
          if (actionLoading) return;
          setPendingCancel(null);
          setDialogError(null);
        }}
      />
    </main>
  );
}
