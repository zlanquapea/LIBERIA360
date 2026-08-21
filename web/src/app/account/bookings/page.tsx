'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import BookingMessageThread from '@/components/BookingMessageThread';
import { cancelBooking, getBusinessBookings, getCreatorBookings, getMyBookings, respondToBooking } from '@/lib/booking-api';
import { getMyBusinesses } from '@/lib/business-api';
import { getMyCreatorProfile } from '@/lib/creator-api';
import { formatBookingStatus } from '@/lib/format';
import { getFriendlyErrorMessage, isNotFoundError } from '@/lib/errors';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Booking, Business, Creator } from '@/lib/types';

// "My Bookings" (Tech Spec §3.3) — client-only, same reasoning as
// /trips: JWT auth lives in localStorage, so a server component can't
// know who's asking. Three independent sections on one page since a user
// can be a guest (requests they sent), a business owner, and/or a
// creator (requests either has received) all at once — the account
// model doesn't distinguish "roles", so neither does this page.
export default function BookingsPage() {
  const { user, token, ready } = useAuth();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [incoming, setIncoming] = useState<Record<string, Booking[]>>({});
  const [incomingCreator, setIncomingCreator] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadMine = useCallback(() => {
    if (!token) return;
    getMyBookings(token).then(setMyBookings);
  }, [token]);

  const reloadIncoming = useCallback(
    (businessId: string) => {
      if (!token) return;
      getBusinessBookings(token, businessId).then((bookings) =>
        setIncoming((prev) => ({ ...prev, [businessId]: bookings })),
      );
    },
    [token],
  );

  const reloadIncomingCreator = useCallback(() => {
    if (!token || !creator) return;
    getCreatorBookings(token, creator.id).then(setIncomingCreator);
  }, [token, creator]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([getMyBookings(token), getMyBusinesses(token), getMyCreatorProfile(token)]).then(
      async ([bookings, myBusinesses, myCreator]) => {
        if (cancelled) return;
        setMyBookings(bookings);
        setBusinesses(myBusinesses);
        setCreator(myCreator);
        const entries = await Promise.all(
          myBusinesses.map(async (b) => [b.id, await getBusinessBookings(token, b.id)] as const),
        );
        const creatorBookings = myCreator ? await getCreatorBookings(token, myCreator.id) : [];
        if (!cancelled) {
          setIncoming(Object.fromEntries(entries));
          setIncomingCreator(creatorBookings);
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  if (!ready || loading) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My Bookings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Log in to see your booking requests.</p>
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
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-6">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">My booking requests</h1>
        {myBookings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
            No booking requests yet. Request to book on any claimed listing&apos;s page.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {myBookings.map((booking) => (
              <li key={booking.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <BookingCard booking={booking} />
                {(booking.status === 'pending' || booking.status === 'confirmed') && token && (
                  <CancelBookingButton token={token} bookingId={booking.id} onCancelled={reloadMine} />
                )}
                <BookingMessageThread bookingId={booking.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {businesses.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Requests for my listings</h2>
          {businesses.map((business) => (
            <div key={business.id} className="flex flex-col gap-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{business.name}</h3>
              {(incoming[business.id] ?? []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {(incoming[business.id] ?? []).map((booking) => (
                    <li key={booking.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                      <BookingCard booking={booking} showGuest />
                      {booking.status === 'pending' && (
                        <OwnerResponseForm
                          bookingId={booking.id}
                          onDone={() => reloadIncoming(business.id)}
                        />
                      )}
                      <BookingMessageThread bookingId={booking.id} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {creator && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Requests for my creator profile</h2>
          {incomingCreator.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {incomingCreator.map((booking) => (
                <li key={booking.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <BookingCard booking={booking} showGuest />
                  {booking.status === 'pending' && (
                    <OwnerResponseForm bookingId={booking.id} onDone={reloadIncomingCreator} />
                  )}
                  <BookingMessageThread bookingId={booking.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

// A guest cancelling their own pending/confirmed booking — notifies the
// listing and can't be undone from here (they'd have to submit a fresh
// request), so it gets the same confirm-dialog treatment as any other
// destructive action rather than firing immediately on click.
function CancelBookingButton({
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
        className="mt-2 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-flag-500 hover:text-flag-700 dark:hover:text-flag-300"
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

function BookingCard({ booking, showGuest }: { booking: Booking; showGuest?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-900 dark:text-slate-50">
          {showGuest ? booking.guest?.name ?? 'A guest' : booking.business?.name ?? booking.creator?.name}
        </p>
        <StatusBadge status={booking.status} />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {new Date(booking.requestedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        {booking.requestedEndDate &&
          ` – ${new Date(booking.requestedEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
        {booking.partySize && ` · Party of ${booking.partySize}`}
      </p>
      {booking.notes && <p className="text-sm text-slate-500 dark:text-slate-400">&ldquo;{booking.notes}&rdquo;</p>}
      {booking.businessResponse && (
        <p className="rounded-lg bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-300">
          Response: {booking.businessResponse}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Booking['status'] }) {
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

function OwnerResponseForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
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
    <div className="mt-2 flex flex-col gap-2">
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
