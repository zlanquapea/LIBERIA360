'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createEvent } from '@/lib/event-api';
import { getMyBusinesses } from '@/lib/business-api';
import { getMyCreatorProfile } from '@/lib/creator-api';
import { HttpError } from '@/lib/http';
import { formatEventCategory } from '@/lib/format';
import type { County, EventCategory } from '@/lib/types';

const EVENT_CATEGORIES: EventCategory[] = ['concert', 'festival', 'sports', 'nightlife', 'seasonal', 'other'];

// Mirrors the API's restriction (EventsService.assertCanPostEvents):
// posting requires a claimed business, a creator profile, or admin — not
// just any logged-in account. Checked client-side too so a traveler with
// neither sees a clear next step instead of filling out the whole form
// and hitting a 403 at the end.
type Eligibility = 'checking' | 'eligible' | 'ineligible';

export function NewEventForm({ counties }: { counties: County[] }) {
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [eligibility, setEligibility] = useState<Eligibility>('checking');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<EventCategory>('other');
  const [countyId, setCountyId] = useState(counties[0]?.id ?? '');
  const [locationText, setLocationText] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [ticketInfo, setTicketInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    if (user.isAdmin) {
      setEligibility('eligible');
      return;
    }
    let cancelled = false;
    Promise.all([getMyBusinesses(token), getMyCreatorProfile(token)])
      .then(([businesses, creator]) => {
        if (cancelled) return;
        setEligibility(businesses.length > 0 || creator ? 'eligible' : 'ineligible');
      })
      .catch(() => {
        if (!cancelled) setEligibility('ineligible');
      });
    return () => {
      cancelled = true;
    };
  }, [user, token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const event = await createEvent(token, {
        name,
        category,
        countyId,
        locationText: locationText.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        description: description.trim() || undefined,
        ticketInfo: ticketInfo.trim() || undefined,
      });
      router.push(`/events/${event.id}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Log in
        </Link>{' '}
        to post an event.
      </p>
    );
  }

  if (eligibility === 'checking') {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Checking your account…</p>;
  }

  if (eligibility === 'ineligible') {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Posting events is limited to businesses and creators, so listings stay tied to a real, accountable account.
        </p>
        <p>
          <Link href="/creators/me" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Set up a creator profile
          </Link>{' '}
          or claim a business from its destination page to unlock this.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Event name
        <input
          type="text"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatEventCategory(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          County
          <select
            required
            value={countyId}
            onChange={(e) => setCountyId(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            {counties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Location
        <input
          type="text"
          required
          maxLength={255}
          placeholder="e.g. Antoinette Tubman Stadium"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Starts
          <input
            type="datetime-local"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Ends (optional)
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          rows={3}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Ticket info
        <input
          type="text"
          maxLength={500}
          placeholder="e.g. $10 at the door, free entry, link to tickets"
          value={ticketInfo}
          onChange={(e) => setTicketInfo(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
      >
        {submitting ? 'Posting…' : 'Post event'}
      </button>
    </form>
  );
}
