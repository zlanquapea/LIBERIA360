'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { formatEventCategory } from '@/lib/format';
import type { County, EventCategory } from '@/lib/types';

const EVENT_CATEGORIES: EventCategory[] = ['concert', 'festival', 'sports', 'nightlife', 'seasonal', 'other'];

export function EventFilters({ counties }: { counties: County[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/events?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Category"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('category') ?? ''}
        onChange={(e) => updateParam('category', e.target.value)}
      >
        <option value="">All categories</option>
        {EVENT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {formatEventCategory(c)}
          </option>
        ))}
      </select>

      <select
        aria-label="County"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('county') ?? ''}
        onChange={(e) => updateParam('county', e.target.value)}
      >
        <option value="">All counties</option>
        {counties.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
