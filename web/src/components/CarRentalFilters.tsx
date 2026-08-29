'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCarCategory, formatCarTransmission } from '@/lib/format';
import type { CarCategory, CarTransmission, County } from '@/lib/types';

const CAR_CATEGORIES: CarCategory[] = [
  'economy',
  'compact',
  'sedan',
  'suv',
  'van',
  'minibus',
  'pickup',
  'luxury',
];

const CAR_TRANSMISSIONS: CarTransmission[] = ['automatic', 'manual'];

// Same structure/debounce pattern as BusinessFilters — search box plus a
// handful of dropdowns/checkboxes, each one a `?key=value` on /car-rentals.
export function CarRentalFilters({ counties }: { counties: County[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/car-rentals?${params.toString()}`);
  }

  useEffect(() => {
    const id = setTimeout(() => {
      if (search !== (searchParams.get('search') ?? '')) {
        updateParam('search', search);
      }
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap gap-2">
      <input
        aria-label="Search car rentals"
        placeholder="Search by make, model, or title…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="basis-full rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500"
      />

      <select
        aria-label="Vehicle category"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('category') ?? ''}
        onChange={(e) => updateParam('category', e.target.value)}
      >
        <option value="">All categories</option>
        {CAR_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {formatCarCategory(c)}
          </option>
        ))}
      </select>

      <select
        aria-label="Transmission"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('transmission') ?? ''}
        onChange={(e) => updateParam('transmission', e.target.value)}
      >
        <option value="">Any transmission</option>
        {CAR_TRANSMISSIONS.map((t) => (
          <option key={t} value={t}>
            {formatCarTransmission(t)}
          </option>
        ))}
      </select>

      <select
        aria-label="County"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('countyId') ?? ''}
        onChange={(e) => updateParam('countyId', e.target.value)}
      >
        <option value="">All counties</option>
        {counties.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Minimum seats"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('minSeats') ?? ''}
        onChange={(e) => updateParam('minSeats', e.target.value)}
      >
        <option value="">Any seats</option>
        {[2, 4, 5, 7, 12].map((n) => (
          <option key={n} value={n}>
            {n}+ seats
          </option>
        ))}
      </select>

      <select
        aria-label="Maximum price per day"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('maxPricePerDay') ?? ''}
        onChange={(e) => updateParam('maxPricePerDay', e.target.value)}
      >
        <option value="">Any price</option>
        {[50, 100, 150, 250, 400].map((n) => (
          <option key={n} value={n}>
            Under ${n}/day
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={searchParams.get('withDriverAvailable') === 'true'}
          onChange={(e) => updateParam('withDriverAvailable', e.target.checked ? 'true' : '')}
          className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-700"
        />
        Driver available
      </label>
    </div>
  );
}
