'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Category, County } from '@/lib/types';

export function SearchFilters({ categories, counties }: { categories: Category[]; counties: County[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // filters changing means results changed — back to page 1
    router.push(`/search?${params.toString()}`);
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
        {categories.map((c) => (
          <option key={c.id} value={c.slug}>
            {c.name}
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

      <select
        aria-label="Sort by"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={searchParams.get('sort') ?? 'featured'}
        onChange={(e) => updateParam('sort', e.target.value)}
      >
        <option value="featured">Featured</option>
        <option value="rating">Highest rated</option>
        <option value="distance">Closest to Monrovia</option>
        <option value="name">Name (A–Z)</option>
      </select>
    </div>
  );
}
