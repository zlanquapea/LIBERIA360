'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdjustmentsHorizontalIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatCreatorCategory } from '@/lib/format';
import { CREATOR_CATEGORIES } from '@/lib/creator-categories';
import type { County } from '@/lib/types';

export function CreatorFilters({ counties }: { counties: County[] }) {
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
    const query = params.toString();
    router.push(query ? `/creators?${query}` : '/creators');
  }

  // Same 300ms debounce as the previous directory search — a router.push per
  // keystroke would spam navigations and re-fetch the directory on every
  // letter typed.
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
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Search creators</span>
        <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          aria-label="Search creators"
          placeholder="Search by name or username…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-950"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="relative block">
          <span className="sr-only">Creator category</span>
          <select
            aria-label="Category"
            className="h-11 w-full appearance-none rounded-full border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-brand-950"
            value={searchParams.get('category') ?? ''}
            onChange={(e) => updateParam('category', e.target.value)}
          >
            <option value="">All categories</option>
            {CREATOR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {formatCreatorCategory(c)}
              </option>
            ))}
          </select>
          <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>

        <label className="relative block">
          <span className="sr-only">Creator county</span>
          <select
            aria-label="County"
            className="h-11 w-full appearance-none rounded-full border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-brand-950"
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
          <ChevronDownIcon aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </label>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <AdjustmentsHorizontalIcon aria-hidden className="h-4 w-4 text-accent-600 dark:text-accent-400" />
        Filter by the creator&apos;s real category or county.
      </p>
    </div>
  );
}
