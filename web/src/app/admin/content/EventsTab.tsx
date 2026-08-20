'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { deleteEventAdmin, updateEventAdmin } from '@/lib/admin-api';
import { getEvents } from '@/lib/api';
import { HttpError } from '@/lib/http';
import { formatEventCategory, formatEventDateRange } from '@/lib/format';
import type { County, Event, EventCategory } from '@/lib/types';
import { BackToListLink, DeleteButton, inputClass } from './content-shared';

const EVENT_CATEGORIES: EventCategory[] = ['concert', 'festival', 'sports', 'nightlife', 'seasonal', 'other'];

type View = { mode: 'list' } | { mode: 'edit'; event: Event };

// No "create" here on purpose — POST /events already exists and already
// auto-qualifies any admin (EventsService.assertCanPostEvents), with a
// full form at /events/new. Linking there instead of duplicating that
// form; this tab is for browsing/editing/removing what already exists.
export function EventsTab({ token, counties }: { token: string; counties: County[] }) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const [view, setView] = useState<View>({ mode: 'list' });

  function reload() {
    getEvents({ limit: 100 }).then((res) => setEvents(res.data));
  }

  useEffect(reload, []);

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
                  <td className="px-4 py-2.5 text-right text-xs font-medium text-brand-700">Edit →</td>
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setName(event.name);
    setCategory(event.category);
    setCountyId(event.county.id);
    setDescription(event.description ?? '');
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
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
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
