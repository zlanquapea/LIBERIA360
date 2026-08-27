'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { deleteEventAdmin, getAllEventsAdmin, setEventReviewStatus, updateEventAdmin } from '@/lib/admin-api';
import { HttpError } from '@/lib/http';
import { formatEventCategory, formatEventDateRange, formatEventReviewStatus } from '@/lib/format';
import { PhotoManager } from '@/components/PhotoManager';
import type { County, Event, EventCategory, EventReviewStatus } from '@/lib/types';
import { BackToListLink, DeleteButton, inputClass } from './content-shared';

const EVENT_CATEGORIES: EventCategory[] = ['concert', 'festival', 'sports', 'nightlife', 'seasonal', 'other'];

const REVIEW_STATUS_BADGE: Record<EventReviewStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  rejected: 'bg-flag-500/10 text-flag-700 dark:text-flag-300',
};

type View = { mode: 'list' } | { mode: 'edit'; event: Event };

// No "create" here on purpose — POST /events already exists and already
// auto-qualifies any admin (EventsService.assertCanPostEvents), with a
// full form at /events/new. Linking there instead of duplicating that
// form; this tab is for browsing/editing/removing what already exists.
export function EventsTab({ token, counties }: { token: string; counties: County[] }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [view, setView] = useState<View>({ mode: 'list' });

  function reload() {
    // Every event regardless of review status — unlike the public GET
    // /events (approved-only) or the old getEvents({includePast:true})
    // this used to call, which stopped including anything once
    // self-submitted events started defaulting to PENDING. Approving/
    // rejecting a PENDING one is one click away via ReviewStatusControl
    // below rather than needing the separate Moderation page for it.
    getAllEventsAdmin(token).then(setEvents);
  }

  useEffect(reload, [token]);

  if (view.mode === 'edit') {
    return (
      <div className="flex flex-col gap-3">
        <BackToListLink label="Back to events" onClick={() => setView({ mode: 'list' })} />
        <EventEditForm
          token={token}
          event={view.event}
          counties={counties}
          onSaved={(updated) => {
            setEvents((prev) => (prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev));
            setView({ mode: 'edit', event: updated });
          }}
          onDeleted={() => {
            setEvents((prev) => (prev ? prev.filter((e) => e.id !== view.event.id) : prev));
            setView({ mode: 'list' });
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          Events
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{events?.length ?? '…'}</span>
        </h2>
        <Link
          href="/events/new"
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + New event
        </Link>
      </div>
      {!events ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No events yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">County</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {events.map((event) => (
                <tr key={event.id} onClick={() => setView({ mode: 'edit', event })} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-50">{event.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatEventCategory(event.category)}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{event.county.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatEventDateRange(event.startDate, event.endDate)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_BADGE[event.reviewStatus]}`}>
                      {formatEventReviewStatus(event.reviewStatus)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-brand-700 dark:text-brand-300">Edit →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EventEditForm({
  token,
  event,
  counties,
  onSaved,
  onDeleted,
}: {
  token: string;
  event: Event;
  counties: County[];
  onSaved: (event: Event) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(event.name);
  const [category, setCategory] = useState<EventCategory>(event.category);
  const [countyId, setCountyId] = useState(event.county.id);
  const [description, setDescription] = useState(event.description ?? '');
  const [images, setImages] = useState<string[]>(event.images);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setName(event.name);
    setCategory(event.category);
    setCountyId(event.county.id);
    setDescription(event.description ?? '');
    setImages(event.images);
    setSuccess(false);
    // Keyed on event.id — a save replaces this event with a new object of
    // the same id, which must not wipe the success message just set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await updateEventAdmin(token, event.id, {
        name,
        category,
        countyId,
        description: description.trim() || undefined,
        images,
      });
      setSuccess(true);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    await deleteEventAdmin(token, event.id);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Edit event</h3>
        {/* Removing an event is moderation, same as removing a flagged
            review — any admin already does this from the dashboard's
            "Flagged content" queue, so it isn't gated to super admin here. */}
        <DeleteButton label="Delete event" onDelete={handleDelete} onDeleted={onDeleted} />
      </div>
      <EventReviewStatusControl token={token} event={event} onChanged={onSaved} />
      <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Name
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value as EventCategory)} className={inputClass}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatEventCategory(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        County
        <select value={countyId} onChange={(e) => setCountyId(e.target.value)} className={inputClass}>
          {counties.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}
      {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved.</p>}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save event'}
      </button>
    </form>
  );
}

// Approve/reject a PENDING event right from its edit form — the same
// decision available from the Moderation page's "Pending events" queue,
// just reachable without leaving the Content > Events table. Already-
// decided events (approved/rejected) show their status as a plain badge;
// re-reviewing one is still possible via the dropdown below it, e.g. to
// reject something that was approved in error.
function EventReviewStatusControl({
  token,
  event,
  onChanged,
}: {
  token: string;
  event: Event;
  onChanged: (event: Event) => void;
}) {
  const [status, setStatus] = useState<EventReviewStatus>(event.reviewStatus === 'pending' ? 'approved' : event.reviewStatus);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await setEventReviewStatus(token, event.id, status, reason.trim() || undefined);
      onChanged(updated);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_BADGE[event.reviewStatus]}`}>
          {formatEventReviewStatus(event.reviewStatus)}
        </span>
        {event.reviewStatus === 'rejected' && event.rejectionReason && (
          <span className="text-xs text-slate-500 dark:text-slate-400">Reason: {event.rejectionReason}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as EventReviewStatus)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-slate-700"
        >
          <option value="approved">Approve</option>
          <option value="rejected">Reject</option>
        </select>
        <button
          type="button"
          disabled={submitting}
          onClick={apply}
          className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Applying…' : 'Apply'}
        </button>
      </div>
      {status === 'rejected' && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          maxLength={1000}
          className="max-w-sm rounded-lg border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      )}
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
    </div>
  );
}
