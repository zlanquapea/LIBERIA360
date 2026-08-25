'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { Category, County } from '@/lib/types';

export function SearchFilters({ categories, counties }: { categories: Category[]; counties: County[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    updateParams({ [key]: value });
  }

  // Price is set as a single "bucket" selection but maps to two separate
  // query params (priceMin/priceMax, matching PlacesQuery) — updating both
  // atomically avoids a round trip that briefly has only one of them set.
  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.delete('page'); // filters changing means results changed — back to page 1
    router.push(`/search?${params.toString()}`);
  }

  const priceBucket =
    searchParams.get('priceMin') != null || searchParams.get('priceMax') != null
      ? `${searchParams.get('priceMin') ?? ''}-${searchParams.get('priceMax') ?? ''}`
      : '';

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

      <select
        aria-label="Price"
        className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200"
        value={priceBucket}
        onChange={(e) => {
          const [priceMin, priceMax] = e.target.value.split('-');
          updateParams({ priceMin: priceMin ?? '', priceMax: priceMax ?? '' });
        }}
      >
        <option value="">Any price</option>
        <option value="0-0">Free</option>
        <option value="0-10">Under $10</option>
        <option value="10-50">$10 – $50</option>
        <option value="50-">$50+</option>
      </select>

      <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          checked={searchParams.get('openNow') === 'true'}
          onChange={(e) => updateParam('openNow', e.target.checked ? 'true' : '')}
          className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
        />
        Open now
      </label>
    </div>
  );
}
