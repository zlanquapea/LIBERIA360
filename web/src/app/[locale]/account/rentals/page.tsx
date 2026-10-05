'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SignedInGate } from '@/components/prescriptions/SignedInGate';
import { RentalCard } from '@/components/rentals/RentalParts';
import { getMyRentals, type Rental } from '@/lib/rentals-api';
import { isOpenRental } from '@/lib/rentals';

function Rentals() {
  const [list, setList] = useState<Rental[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyRentals()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load your rentals.'));
  }, []);

  const current = (list ?? []).filter(isOpenRental).sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));
  const past = (list ?? []).filter((r) => !isOpenRental(r));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Travel</p>
        <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">My rentals</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cars you&apos;ve booked, from pickup to return.</p>
      </div>
      {error && (
        <p role="alert" className="error-state">
          {error}
        </p>
      )}
      {list === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {list?.length === 0 && (
        <p className="empty-state">
          No rentals yet.{' '}
          <Link href="/car-rentals" className="font-semibold text-brand-700 underline">
            Find a car
          </Link>
          .
        </p>
      )}
      {current.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Current and upcoming</h2>
          {current.map((r) => (
            <RentalCard key={r.id} r={r} href={`/account/rentals/${r.id}`} />
          ))}
        </section>
      )}
      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">Earlier</h2>
          {past.map((r) => (
            <RentalCard key={r.id} r={r} href={`/account/rentals/${r.id}`} />
          ))}
        </section>
      )}
    </main>
  );
}

export default function MyRentalsPage() {
  return (
    <SignedInGate title="My rentals" reason="Log in to see your car rentals.">
      <Rentals />
    </SignedInGate>
  );
}
