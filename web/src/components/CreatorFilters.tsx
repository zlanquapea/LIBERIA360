'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatCreatorCategory } from '@/lib/format';
import { CREATOR_CATEGORIES } from '@/lib/creator-categories';
import type { County } from '@/lib/types';

// LinkedIn-style search bar + filter-chip row for the creator directory
// (redesign, Sep 2026). The category `<select>` this replaced hid all 8
// options behind one tap and a scroll; LinkedIn's own people-search puts
// its handful of common filters as a horizontally scrollable chip row
// right under the search box instead, so every category is visible and
// one tap away. County stays a `<select>` — with ~15 counties a chip row
// would just wrap into its own multi-line mess — but is now styled to
// match the chips instead of looking like a leftover form control.
export function CreatorFilters({ counties }: { counties: County[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const activeCategory = searchParams.get('category') ?? '';
  const activeCountyId = searchParams.get('countyId') ?? '';

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

      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => updateParam('category', '')}
          aria-pressed={activeCategory === ''}
          className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
            activeCategory === ''
              ? 'bg-brand-700 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30'
          }`}
        >
          All
        </button>
        {CREATOR_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => updateParam('category', activeCategory === c ? '' : c)}
            aria-pressed={activeCategory === c}
            className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
              activeCategory === c
                ? 'bg-brand-700 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30'
            }`}
          >
            {formatCreatorCategory(c)}
          </button>
        ))}
      </div>

      <label className="relative block w-full sm:w-64">
        <span className="sr-only">Creator county</span>
        <select
          aria-label="County"
          className="h-10 w-full appearance-none rounded-full border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-brand-950"
          value={activeCountyId}
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
  );
}
