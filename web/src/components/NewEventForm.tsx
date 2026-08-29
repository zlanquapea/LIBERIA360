'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createEvent, updateEvent } from '@/lib/event-api';
import { getMyBusinesses } from '@/lib/business-api';
import { getMyCreatorProfile } from '@/lib/creator-api';
import { HttpError } from '@/lib/http';
import { formatEventCategory, toDatetimeLocalInput } from '@/lib/format';
import { PhotoManager } from './PhotoManager';
import type { County, Event, EventCategory } from '@/lib/types';

const EVENT_CATEGORIES: EventCategory[] = ['concert', 'festival', 'sports', 'nightlife', 'seasonal', 'other'];

// Mirrors the API's restriction (EventsService.assertCanPostEvents):
// posting requires a claimed business, a creator profile, or admin — not
// just any logged-in account. Checked client-side too so a traveler with
// neither sees a clear next step instead of filling out the whole form
// and hitting a 403 at the end. Not checked at all when editing (`event`
// passed in) — an organizer who already posted one is allowed to fix it
// even if they later lose eligibility, same as the API's ownership-only
// check on PATCH/DELETE.
type Eligibility = 'checking' | 'eligible' | 'ineligible';

// Same component handles both posting a new event (from /events/new) and
// editing one you already posted (from /account/my-events) — the `event`
// prop switches it into edit mode, mirroring PlaceSubmissionForm's
// create/edit dual-mode pattern. Editing calls `onSaved` instead of
// redirecting, so the caller decides what happens next (e.g. update a list
// in place) rather than this component hardcoding a destination.
export function NewEventForm({
  counties,
  event,
  onSaved,
}: {
  counties: County[];
  event?: Event;
  onSaved?: (event: Event) => void;
}) {
  const router = useRouter();
  const { user, token, ready } = useAuth();
  const [eligibility, setEligibility] = useState<Eligibility>(event ? 'eligible' : 'checking');

  const [name, setName] = useState(event?.name ?? '');
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'other');
  const [countyId, setCountyId] = useState(event?.county.id ?? counties[0]?.id ?? '');
  const [locationText, setLocationText] = useState(event?.locationText ?? '');
  const [startDate, setStartDate] = useState(event ? toDatetimeLocalInput(event.startDate) : '');
  const [endDate, setEndDate] = useState(event?.endDate ? toDatetimeLocalInput(event.endDate) : '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [images, setImages] = useState<string[]>(event?.images ?? []);
  const [ticketInfo, setTicketInfo] = useState(event?.ticketInfo ?? '');
  const [ticketPrice, setTicketPrice] = useState(event?.ticketPrice ?? '');
  const [ticketCurrency, setTicketCurrency] = useState(event?.ticketCurrency ?? 'LRD');
  const [ticketCapacity, setTicketCapacity] = useState(event?.ticketCapacity?.toString() ?? '');
  const [paymentInstructions, setPaymentInstructions] = useState(event?.paymentInstructions ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) return; // editing — eligibility already established by having posted it
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
  }, [event, user, token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        name,
        category,
        countyId,
        locationText: locationText.trim() || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        description: description.trim() || undefined,
        images,
        ticketInfo: ticketInfo.trim() || undefined,
        ticketPrice: ticketPrice.trim() || undefined,
        ticketCurrency: ticketCurrency.trim().toUpperCase() || undefined,
        ticketCapacity: ticketCapacity.trim() || undefined,
        paymentInstructions: paymentInstructions.trim() || undefined,
      };
      const saved = event ? await updateEvent(token, event.id, input) : await createEvent(token, input);
      if (onSaved) {
        onSaved(saved);
      } else {
        router.push(`/events/${saved.id}`);
      }
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
      {token && <PhotoManager token={token} images={images} onChange={setImages} label="Photos" />}

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

      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-900/60 dark:bg-brand-950/30">
        <p className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Paid tickets (manual payment)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Price per ticket
            <input type="number" min="0.01" step="0.01" placeholder="e.g. 500" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Currency
            <select value={ticketCurrency} onChange={(e) => setTicketCurrency(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
              <option value="LRD">LRD</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Ticket capacity
            <input type="number" min="1" step="1" placeholder="Optional" value={ticketCapacity} onChange={(e) => setTicketCapacity(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Payment instructions
          <textarea maxLength={1000} rows={2} placeholder="e.g. Send payment to Lonestar Mobile Money 0777 000 000 and enter the transaction reference below." value={paymentInstructions} onChange={(e) => setPaymentInstructions(e.target.value)} className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm" />
        </label>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Buyers submit their payment reference. You verify it before tickets are issued.</p>
      </div>

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
        {submitting ? 'Saving…' : event ? 'Save changes' : 'Post event'}
      </button>
    </form>
  );
}
