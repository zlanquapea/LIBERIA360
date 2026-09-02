'use client';

import { useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { PlaceCard } from './PlaceCard';
import { CategoryIcon } from '@/lib/icons';
import type { Place } from '@/lib/types';

interface CategoryOption {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
}

// Product feedback: a county page with only a handful of places (most
// counties are still "growing" per rolloutStage) looked cluttered with a
// full search+filter toolbar sitting above a single card — filtering only
// earns its keep once there's actually enough to sort through, either
// enough places to make scanning them all a chore or more than one
// category to choose between. Below this, just show the grid.
const FILTER_WORTH_IT_PLACE_COUNT = 6;

// All of a county's places are already fetched server-side (getCountyPlaces,
// capped at 50) for SEO and a fast first paint, so filtering here is a pure
// client-side narrow of that array — no network round trip, no page
// reload, filters as you type/tap.
export function CountyPlacesExplorer({ places, countyName }: { places: Place[]; countyName: string }) {
  const [query, setQuery] = useState('');
  const [categorySlug, setCategorySlug] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen = new Map<string, CategoryOption>();
    for (const place of places) {
      if (!seen.has(place.category.slug)) {
        seen.set(place.category.slug, {
          id: place.category.id,
          slug: place.category.slug,
          name: place.category.name,
          icon: place.category.icon,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [places]);

  const showToolbar = places.length >= FILTER_WORTH_IT_PLACE_COUNT || categories.length > 1;

  const filtered = useMemo(() => {
    if (!showToolbar) return places;
    const q = query.trim().toLowerCase();
    return places.filter((place) => {
      if (categorySlug && place.category.slug !== categorySlug) return false;
      if (!q) return true;
      return (
        place.name.toLowerCase().includes(q) ||
        place.description.toLowerCase().includes(q) ||
        place.city.toLowerCase().includes(q)
      );
    });
  }, [places, query, categorySlug, showToolbar]);

  if (!showToolbar) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {places.map((place, i) => (
          <PlaceCard key={place.id} place={place} index={i} />
        ))}
      </div>
    );
  }

  const selectedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;
  const hasActiveFilter = query.trim() !== '' || categorySlug !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <label className="relative block">
          <span className="sr-only">Search places in {countyName}</span>
          <MagnifyingGlassIcon
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-label={`Search places in ${countyName}`}
            placeholder={`Search ${countyName}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-brand-950"
          />
        </label>

        {categories.length > 1 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <button
              type="button"
              onClick={() => setCategorySlug(null)}
              aria-pressed={categorySlug === null}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                categorySlug === null
                  ? 'border-transparent bg-brand-700 text-white'
                  : 'border-slate-300 text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategorySlug(category.slug)}
                aria-pressed={categorySlug === category.slug}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  categorySlug === category.slug
                    ? 'border-transparent bg-brand-700 text-white'
                    : 'border-slate-300 text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200'
                }`}
              >
                <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-4 w-4" />
                {category.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {hasActiveFilter ? `${filtered.length} of ${places.length}` : places.length} place
        {places.length === 1 && !hasActiveFilter ? '' : 's'}
      </p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((place, i) => (
            <PlaceCard key={place.id} place={place} index={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No {selectedCategory ? selectedCategory.name.toLowerCase() : 'places'} in {countyName}
            {query.trim() ? ` match “${query.trim()}”` : ''}.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCategorySlug(null);
            }}
            className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
