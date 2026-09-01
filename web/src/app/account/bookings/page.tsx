'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  getBusinessBookings,
  getCarListingOwnerBookings,
  getCreatorBookings,
  getMyBookings,
} from '@/lib/booking-api';
import { getMyBusinesses } from '@/lib/business-api';
import { getMyCreatorProfile } from '@/lib/creator-api';
import { getMyCarListings } from '@/lib/car-rentals-api';
import { BookingDetailModal, BookingRow, type SelectedBooking } from '@/components/booking-ui';
import { BrandLoader } from '@/components/BrandLoader';
import type { Booking, Business, CarListing, Creator } from '@/lib/types';

// "My Bookings" (Tech Spec §3.3) — client-only, same reasoning as
// /trips: JWT auth lives in localStorage, so a server component can't
// know who's asking. Three independent sections on one page since a user
// can be a guest (requests they sent), a business owner, and/or a
// creator (requests either has received) all at once — the account
// model doesn't distinguish "roles", so neither does this page.
//
// Each list renders compact rows only (product feedback, Aug 2026: "don't
// put the messaging and the booking on that one page to make things
// long") — the full detail, the confirm/decline or cancel action, and the
// message thread all live in one BookingDetailModal opened by clicking a
// row, so a page with many bookings stays a short scannable list instead
// of a wall of inline forms and chat threads.
export default function BookingsPage() {
  const { user, token, ready } = useAuth();
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [carListings, setCarListings] = useState<CarListing[]>([]);
  const [incoming, setIncoming] = useState<Record<string, Booking[]>>({});
  const [incomingCreator, setIncomingCreator] = useState<Booking[]>([]);
  const [incomingCarListings, setIncomingCarListings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedBooking | null>(null);

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

  const reloadIncomingCarListings = useCallback(() => {
    if (!token) return;
    getCarListingOwnerBookings(token).then(setIncomingCarListings);
  }, [token]);

  useEffect(() => {
    if (!ready || !token) {
      if (ready) setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      getMyBookings(token),
      getMyBusinesses(token),
      getMyCreatorProfile(token),
      getMyCarListings(token),
    ]).then(async ([bookings, myBusinesses, myCreator, myCarListings]) => {
      if (cancelled) return;
      setMyBookings(bookings);
      setBusinesses(myBusinesses);
      setCreator(myCreator);
      setCarListings(myCarListings);
      const entries = await Promise.all(
        myBusinesses.map(async (b) => [b.id, await getBusinessBookings(token, b.id)] as const),
      );
      const creatorBookings = myCreator ? await getCreatorBookings(token, myCreator.id) : [];
      const carListingBookings = myCarListings.length > 0 ? await getCarListingOwnerBookings(token) : [];
      if (!cancelled) {
        setIncoming(Object.fromEntries(entries));
        setIncomingCreator(creatorBookings);
        setIncomingCarListings(carListingBookings);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, token]);

  if (!ready || loading) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4">
        <BrandLoader />
        <p className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Loading…</p>
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
          <ul className="flex flex-col gap-2">
            {myBookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                onOpen={() =>
                  setSelected({
                    booking,
                    canCancel: booking.status === 'pending' || booking.status === 'confirmed',
                    onCancelled: () => {
                      reloadMine();
                      setSelected(null);
                    },
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {businesses.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Requests for my listings</h2>
          {businesses.map((business) => (
            <div key={business.id} className="flex flex-col gap-2">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{business.name}</h3>
              {(incoming[business.id] ?? []).length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {(incoming[business.id] ?? []).map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      showGuest
                      onOpen={() =>
                        setSelected({
                          booking,
                          showGuest: true,
                          canRespond: booking.status === 'pending',
                          onResponded: () => {
                            reloadIncoming(business.id);
                            setSelected(null);
                          },
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {creator && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Requests for my creator profile</h2>
          {incomingCreator.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {incomingCreator.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  showGuest
                  onOpen={() =>
                    setSelected({
                      booking,
                      showGuest: true,
                      canRespond: booking.status === 'pending',
                      onResponded: () => {
                        reloadIncomingCreator();
                        setSelected(null);
                      },
                    })
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {carListings.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Requests for my car listings</h2>
          {incomingCarListings.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {incomingCarListings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  showGuest
                  onOpen={() =>
                    setSelected({
                      booking,
                      showGuest: true,
                      canRespond: booking.status === 'pending',
                      onResponded: () => {
                        reloadIncomingCarListings();
                        setSelected(null);
                      },
                    })
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {selected && token && (
        <BookingDetailModal selected={selected} token={token} onClose={() => setSelected(null)} />
      )}
    </main>
  );
}
