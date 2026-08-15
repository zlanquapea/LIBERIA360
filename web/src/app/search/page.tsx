import Link from 'next/link';
import { getCategories, getCounties, getPlaces } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { SearchFilters } from '@/components/SearchFilters';
import type { PlaceSort, PlacesQuery } from '@/lib/types';

export const metadata = { title: 'Search — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Search Results screen — filterable, sortable list (Tech Spec §4.1).
export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = first(params.q);
  const category = first(params.category);
  const county = first(params.county);
  const sort = (first(params.sort) as PlaceSort | undefined) ?? 'featured';
  const page = Number(first(params.page) ?? '1') || 1;

  const query: PlacesQuery = { q, category, county, sort, page, limit: 12 };

  const [categories, counties, result] = await Promise.all([getCategories(), getCounties(), getPlaces(query)]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (category) p.set('category', category);
    if (county) p.set('county', county);
    if (sort) p.set('sort', sort);
    p.set('page', String(targetPage));
    return `/search?${p.toString()}`;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <form action="/search" method="GET" className="flex overflow-hidden rounded-full border border-slate-300">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search places, food, activities..."
          className="w-full px-4 py-2.5 text-sm outline-none"
        />
        <button type="submit" className="px-4 text-lg" aria-label="Search">
          🔍
        </button>
      </form>

      <SearchFilters categories={categories} counties={counties} />

      <p className="text-sm text-slate-500">
        {result.meta.total} result{result.meta.total === 1 ? '' : 's'}
        {q && ` for "${q}"`}
      </p>

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-slate-500">
          No places match your search yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.data.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300' : 'text-brand-700 hover:underline'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= result.meta.totalPages}
            className={`text-sm font-medium ${
              page >= result.meta.totalPages ? 'pointer-events-none text-slate-300' : 'text-brand-700 hover:underline'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
