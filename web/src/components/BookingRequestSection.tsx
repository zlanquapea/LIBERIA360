'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createBooking } from '@/lib/booking-api';
import { recordAnalyticsEvent, recordCreatorAnalyticsEvent } from '@/lib/analytics-api';
import { HttpError } from '@/lib/http';
import { formatBookingStatus } from '@/lib/format';
import type { Business, Creator, BookingStatus } from '@/lib/types';

// "Request to book" (Tech Spec §3.3). Request-to-book only — no real
// payment capture yet (see Booking.paymentProvider: MTN MoMo is the
// intended provider for Liberia, wired into the schema but not called
// against a live API until credentials exist). Sits under the claimed
// business's contact card on the Destination Profile, or the creator's
// contact card on their public profile — exactly one of business/creator
// (same XOR as CreateBookingInput). Hidden entirely for an unclaimed
// business listing, since there's no one to send the request to.
export function BookingRequestSection({ business, creator }: { business?: Business; creator?: Creator }) {
  const { user, token, ready } = useAuth();
  const targetId = business?.id ?? creator!.id;
  const isOwner = business ? user?.id === business.owner?.id : user?.id === creator!.user?.id;

  const [showForm, setShowForm] = useState(false);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedEndDate, setRequestedEndDate] = useState('');
  const [partySize, setPartySize] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ status: BookingStatus } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const booking = await createBooking(token, {
        businessId: business?.id,
        creatorId: creator?.id,
        requestedDate,
        requestedEndDate: requestedEndDate || undefined,
        partySize: partySize ? Number(partySize) : undefined,
        notes: notes.trim() || undefined,
      });
      setSent({ status: booking.status });
      setShowForm(false);
      if (business) {
        recordAnalyticsEvent(business.linkedPlaceId, 'booking_request');
      } else {
        recordCreatorAnalyticsEvent(targetId, 'booking_request');
      }
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (isOwner) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        You manage this listing —{' '}
        <Link href="/account/bookings" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          view incoming requests
        </Link>
        .
      </p>
    );
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <p className="font-medium">Request sent — {formatBookingStatus(sent.status).toLowerCase()}.</p>
        <p className="mt-1">
          You&apos;ll hear back with a confirm or decline. Track it under{' '}
          <Link href="/account/bookings" className="font-medium underline">
            My Bookings
          </Link>
          .
        </p>
      </div>
    );
  }

  if (!ready) return null;

  if (!user) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
        <Link href="/login" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Log in
        </Link>{' '}
        to request a booking.
      </p>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
      >
        Request to book
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Date
          <input
            type="date"
            required
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Check-out (optional)
          <input
            type="date"
            value={requestedEndDate}
            onChange={(e) => setRequestedEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Party size (optional)
        <input
          type="number"
          min={1}
          max={50}
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Leave a message (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
          {error}
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        This sends a request rather than an instant booking — you&apos;ll get a confirm or decline. No payment is taken now.
      </p>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send request'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
