'use client';

import { useState } from 'react';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import BookingMessageThread from '@/components/BookingMessageThread';
import { cancelBooking, respondToBooking } from '@/lib/booking-api';
import { formatBookingWhen, formatBookingStatus, formatCost } from '@/lib/format';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Booking } from '@/lib/types';

// Shared row/modal pieces for "a list of bookings with a click-through
// detail view" — originally built for the combined /account/bookings page
// and extracted here so the business owner's dashboard
// (BusinessBookingsManager) can render the exact same UI for one
// business's incoming requests without duplicating ~250 lines of modal,
// status-badge, and respond/cancel logic.

export interface SelectedBooking {
  booking: Booking;
  showGuest?: boolean;
  canCancel?: boolean;
  canRespond?: boolean;
  onCancelled?: () => void;
  onResponded?: () => void;
}

// Who a row/modal names as "the other side" of the booking — the guest's
// name when viewing incoming requests for a listing, the listing's name
// when viewing a guest's own requests.
export function counterpartName(booking: Booking, showGuest?: boolean): string {
  return showGuest
    ? booking.guest?.name ?? 'A guest'
    : booking.business?.name ?? booking.creator?.name ?? booking.carListing?.title ?? 'Listing';
}

// A small colored initial badge — cheap stand-in for an avatar that gives
// every row a bit of personality instead of a bare wall of text.
export function InitialBadge({ name, size = 10 }: { name: string; size?: 8 | 10 | 11 }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const sizeClass = size === 8 ? 'h-8 w-8 text-xs' : size === 11 ? 'h-11 w-11 text-base' : 'h-10 w-10 text-sm';
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-800 font-semibold text-white ${sizeClass}`}
    >
      {initial}
    </span>
  );
}

export function StatusBadge({ status }: { status: Booking['status'] }) {
  const styles: Record<Booking['status'], string> = {
    pending: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
    confirmed: 'bg-emerald-100 text-emerald-800',
    declined: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
    cancelled: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
  };
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}>
      {formatBookingStatus(status)}
    </span>
  );
}

// One compact, clickable summary of a booking. Tapping it (or the chat
// icon) is the only way in — full details, actions, and the message
// thread all live behind that one click, in BookingDetailModal.
export function BookingRow({ booking, showGuest, onOpen }: { booking: Booking; showGuest?: boolean; onOpen: () => void }) {
  const name = counterpartName(booking, showGuest);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/60 dark:hover:bg-brand-950/20"
      >
        <InitialBadge name={name} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-slate-900 dark:text-slate-50">{name}</span>
            <StatusBadge status={booking.status} />
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
            {formatBookingWhen(
              booking.requestedDate,
              booking.requestedEndDate,
              booking.rentalUnit,
              booking.requestedStartTime,
              booking.requestedEndTime,
            )}
            {booking.partySize && ` · Party of ${booking.partySize}`}
          </span>
        </span>
        <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-300" />
      </button>
    </li>
  );
}

// The single home for everything about one booking: its details, whichever
// action applies (a guest can cancel, an owner can respond while pending),
// and the full conversation — opened from a BookingRow click, closed by
// the backdrop, the × button, or a completed action.
export function BookingDetailModal({
  selected,
  token,
  onClose,
}: {
  selected: SelectedBooking;
  token: string;
  onClose: () => void;
}) {
  const { booking, showGuest, canCancel, canRespond, onCancelled, onResponded } = selected;
  const name = counterpartName(booking, showGuest);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Booking with ${name}`}
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50 p-0 animate-fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl animate-fade-in-up dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <InitialBadge name={name} size={11} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900 dark:text-slate-50">{name}</p>
            <StatusBadge status={booking.status} />
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <XMarkIcon aria-hidden className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-1.5 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/60">
            <p className="text-slate-700 dark:text-slate-200">
              {formatBookingWhen(
                booking.requestedDate,
                booking.requestedEndDate,
                booking.rentalUnit,
                booking.requestedStartTime,
                booking.requestedEndTime,
              )}
              {booking.partySize && ` · Party of ${booking.partySize}`}
            </p>
            {booking.estimatedTotal != null && (
              <p className="font-medium text-slate-900 dark:text-slate-50">
                Estimated total: {formatCost(booking.estimatedTotal)}
              </p>
            )}
            {booking.notes && <p className="text-slate-500 dark:text-slate-400">&ldquo;{booking.notes}&rdquo;</p>}
            {booking.businessResponse && (
              <p className="mt-1 rounded-lg bg-white px-2.5 py-1.5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                Response: {booking.businessResponse}
              </p>
            )}
          </div>

          {canRespond && onResponded && <OwnerResponseForm bookingId={booking.id} onDone={onResponded} />}

          {canCancel && onCancelled && <CancelBookingButton token={token} bookingId={booking.id} onCancelled={onCancelled} />}

          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <BookingMessageThread bookingId={booking.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

// A guest cancelling their own pending/confirmed booking — notifies the
// listing and can't be undone from here (they'd have to submit a fresh
// request), so it gets the same confirm-dialog treatment as any other
// destructive action rather than firing immediately on click.
export function CancelBookingButton({
  token,
  bookingId,
  onCancelled,
}: {
  token: string;
  bookingId: string;
  onCancelled: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setCancelling(true);
    setError(null);
    try {
      await cancelBooking(token, bookingId);
      setConfirming(false);
      onCancelled();
    } catch (err) {
      if (isNotFoundError(err)) {
        // Already gone (cancelled elsewhere, or the listing removed it) —
        // that's the outcome the user was asking for either way.
        setConfirming(false);
        onCancelled();
      } else {
        setError(getFriendlyErrorMessage(err, { context: { action: 'cancel-booking', bookingId } }));
      }
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="self-start rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-flag-500 hover:text-flag-700 dark:hover:text-flag-300"
      >
        Cancel request
      </button>
      <ConfirmDialog
        open={confirming}
        title="Cancel this booking request?"
        description="The listing will be notified you're no longer interested. You can always submit a new request later."
        confirmLabel="Cancel Request"
        cancelLabel="Keep Booking"
        loadingLabel="Cancelling…"
        isLoading={cancelling}
        error={error}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (cancelling) return;
          setConfirming(false);
          setError(null);
        }}
      />
    </>
  );
}

export function OwnerResponseForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const { token } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState<'confirm' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: 'confirm' | 'decline') {
    if (!token) return;
    setSubmitting(action);
    setError(null);
    try {
      await respondToBooking(token, bookingId, action, message.trim() || undefined);
      onDone();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, { context: { action: 'respond-to-booking', bookingId } }));
      setSubmitting(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        placeholder="Optional message to the guest"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={1000}
        className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {error && <p className="text-xs text-flag-700 dark:text-flag-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => respond('confirm')}
          className="rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {submitting === 'confirm' ? 'Confirming…' : 'Confirm'}
        </button>
        <button
          type="button"
          disabled={submitting !== null}
          onClick={() => respond('decline')}
          className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-flag-500 hover:text-flag-700 dark:hover:text-flag-300 disabled:opacity-60"
        >
          {submitting === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </div>
  );
}
