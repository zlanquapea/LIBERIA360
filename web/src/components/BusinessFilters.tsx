'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatBusinessType } from '@/lib/format';
import { BUSINESS_TYPES } from '@/lib/business-categories';
import type { County } from '@/lib/types';

export function BusinessFilters({ counties }: { counties: County[] }) {
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
    router.push(`/businesses?${params.toString()}`);
  }

  // Same 300ms debounce as CreatorFilters/admin search boxes — a
  // router.push per keystroke would spam navigations and re-fetch the
  // directory on every letter typed.
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
        aria-label="Search businesses"
        placeholder="Search by name or description…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="basis-full rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-brand-500"
      />

      <select
        aria-label="Business type"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('type') ?? ''}
        onChange={(e) => updateParam('type', e.target.value)}
      >
        <option value="">All types</option>
        {BUSINESS_TYPES.map((t) => (
          <option key={t} value={t}>
            {formatBusinessType(t)}
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
    </div>
  );
}
