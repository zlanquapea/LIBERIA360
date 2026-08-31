'use client';

import { useCallback, useEffect, useState } from 'react';
import { getBusinessBookings } from '@/lib/booking-api';
import { BookingDetailModal, BookingRow, type SelectedBooking } from '@/components/booking-ui';
import type { Booking } from '@/lib/types';

// A restaurant/hotel/tour owner's incoming booking requests for one
// business — same self-fetching "{ token, businessId }" shape as
// MenuItemsManager/FoodOrdersManager/BusinessContentManager, so the
// business dashboard can drop it in as a tab without wiring up its own
// fetch/reload plumbing. Built on the same BookingRow/BookingDetailModal
// pieces the combined /account/bookings page uses, so a request looks and
// behaves identically wherever an owner encounters it.
export function BusinessBookingsManager({ token, businessId }: { token: string; businessId: string }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [selected, setSelected] = useState<SelectedBooking | null>(null);

  const reload = useCallback(() => {
    getBusinessBookings(token, businessId).then(setBookings);
  }, [token, businessId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (bookings === null) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading booking requests…</p>;
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">Booking requests</h3>
      {bookings.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No requests yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookings.map((booking) => (
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
                    reload();
                    setSelected(null);
                  },
                })
              }
            />
          ))}
        </ul>
      )}

      {selected && <BookingDetailModal selected={selected} token={token} onClose={() => setSelected(null)} />}
    </div>
  );
}
