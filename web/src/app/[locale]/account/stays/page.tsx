'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { StayCard } from '@/components/stays/StayParts';
import { getMyStays, type Reservation } from '@/lib/stays-api';
import { isOpenStay } from '@/lib/stays';

function Stays() {
  const [list, setList] = useState<Reservation[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyStays()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your stays.'));
  }, []);

  const upcoming = (list ?? []).filter(isOpenStay).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const past = (list ?? []).filter((r) => !isOpenStay(r));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Travel</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">My stays</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hotel and lodge rooms you&apos;ve booked.</p>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list?.length === 0 && (
        <p className="empty-state">
          No stays yet.{' '}
          <Link href="/categories/hotels-lodges" className="font-semibold text-brand-700 underline">
            Find a place to stay
          </Link>
          .
        </p>
      )}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Upcoming</h2>
          {upcoming.map((r) => (
            <StayCard key={r.id} r={r} href={`/account/stays/${r.id}`} />
          ))}
        </section>
      )}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Earlier</h2>
          {past.map((r) => (
            <StayCard key={r.id} r={r} href={`/account/stays/${r.id}`} />
          ))}
        </section>
      )}
    </main>
  );
}

export default function MyStaysPage() {
  return (
    <SignedInGate title="My stays" reason="Log in to see your hotel bookings.">
      <Stays />
    </SignedInGate>
  );
}
