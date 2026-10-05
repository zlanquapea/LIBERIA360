'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { SafeImage } from '@/components/SafeImage';
import { getMyTripBookings, type TripBooking } from '@/lib/group-trips-api';
import { PAYMENT_BADGES, STATUS_STYLES, TRAVELLER_STATUS_LABELS, countdown, dateRange, isActiveBooking, money } from '@/lib/group-trips';
import { resolveImageUrl } from '@/lib/images';

function BookingRow({ b }: { b: TripBooking }) {
  const pay = PAYMENT_BADGES[b.paymentStatus];
  const leaves = b.status === 'confirmed' ? countdown(b.trip.startDate) : null;
  return (
    <Link
      href={`/account/trip-bookings/${b.id}`}
      className="flex gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <SafeImage
        src={b.trip.coverImage ? resolveImageUrl(b.trip.coverImage) : null}
        alt=""
        className="h-20 w-24 shrink-0 rounded-2xl object-cover"
        fallback={<div aria-hidden className="flex h-20 w-24 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl dark:bg-brand-950/40">🚌</div>}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate font-semibold text-slate-950 dark:text-slate-50">{b.trip.title}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {dateRange(b.trip.startDate, b.trip.endDate)}
              {b.trip.destination ? ` · ${b.trip.destination.name}` : ''}
            </span>
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[b.status]}`}>{TRAVELLER_STATUS_LABELS[b.status]}</span>
        </span>
        {leaves && <span className="text-xs font-bold text-sunset-700 dark:text-sunset-300">{leaves}</span>}
        <span className="mt-auto flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          #{b.code} · {b.seats} {b.seats === 1 ? 'spot' : 'spots'}
          {b.totalAmount > 0 && ` · ${money(b.totalAmount, b.currency)}`}
          {b.paymentStatus !== 'free' && b.paymentStatus !== 'paid' && (
            <span className={`rounded-full px-2 py-0.5 font-semibold ${pay.style}`}>{pay.label}</span>
          )}
        </span>
      </span>
    </Link>
  );
}

function TripBookings() {
  const [list, setList] = useState<TripBooking[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    getMyTripBookings()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your bookings.'));
  }, []);
  const upcoming = (list ?? [])
    .filter((b) => isActiveBooking(b) && b.trip.status !== 'completed')
    .sort((a, b) => (a.trip.startDate ?? '').localeCompare(b.trip.startDate ?? ''));
  const past = (list ?? []).filter((b) => !upcoming.includes(b));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Travel</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">My trip bookings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Spots you&apos;ve booked on organised group trips — your tickets live here.</p>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list?.length === 0 && (
        <p className="empty-state">
          No trip bookings yet.{' '}
          <Link href="/trips/community" className="font-semibold text-brand-700 underline">
            Find a group trip
          </Link>
          .
        </p>
      )}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Coming up</h2>
          {upcoming.map((b) => (
            <BookingRow key={b.id} b={b} />
          ))}
        </section>
      )}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Earlier</h2>
          {past.map((b) => (
            <BookingRow key={b.id} b={b} />
          ))}
        </section>
      )}
    </main>
  );
}

export default function MyTripBookingsPage() {
  return (
    <SignedInGate title="My trip bookings" reason="Log in to see your trip bookings.">
      <TripBookings />
    </SignedInGate>
  );
}
