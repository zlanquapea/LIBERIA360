import Link from 'next/link';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { getCategories, getCounties, getPlaces } from '@/lib/api';
import { findMatchingCategory } from '@/lib/category-match';
import { PlaceCard } from '@/components/PlaceCard';
import { SearchFilters } from '@/components/SearchFilters';
import type { Category, PlaceSort, PlacesQuery } from '@/lib/types';

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
  const openNow = first(params.openNow) === 'true';

  const query: PlacesQuery = { q, category, county, sort, page, limit: 12, openNow: openNow || undefined };

  const [categories, counties, result] = await Promise.all([getCategories(), getCounties(), getPlaces(query)]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (category) p.set('category', category);
    if (county) p.set('county', county);
    if (sort) p.set('sort', sort);
    if (openNow) p.set('openNow', 'true');
    p.set('page', String(targetPage));
    return `/search?${p.toString()}`;
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <form
        action="/search"
        method="GET"
        className="flex overflow-hidden rounded-full border border-slate-300 dark:border-slate-700 transition-shadow focus-within:ring-2 focus-within:ring-brand-400"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search places, food, activities..."
          className="w-full px-4 py-2.5 text-sm outline-none"
        />
        <button
          type="submit"
          className="flex items-center px-4 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Search"
        >
          <MagnifyingGlassIcon aria-hidden className="h-5 w-5" />
        </button>
      </form>

      <SearchFilters categories={categories} counties={counties} />

      <p className="text-sm text-slate-500 dark:text-slate-400">
        {result.meta.total} result{result.meta.total === 1 ? '' : 's'}
        {q && ` for "${q}"`}
      </p>

      {result.data.length === 0 ? (
        <ZeroResultsRecovery q={q} categories={categories} hasFilters={Boolean(category || county || openNow)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {result.data.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}

      <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-3 text-center text-sm text-slate-500 dark:text-slate-400">
        Don&apos;t see your destination?{' '}
        <Link href="/places/submit" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
          Add it to LIBERIA360
        </Link>
      </p>

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 dark:text-brand-300 hover:underline'}`}
          >
            ← Previous
          </Link>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Page {result.meta.page} of {result.meta.totalPages}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={page >= result.meta.totalPages}
            className={`text-sm font-medium ${
              page >= result.meta.totalPages ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 dark:text-brand-300 hover:underline'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}

// Product review readout (Aug 22, 2026): a zero-result search used to be a
// dead end — a bare "no places match" with no way forward besides
// re-typing. This routes a visitor toward whatever's actually likely to
// help: the matching category if the query is close to one (or already
// filtered), a link to browse everything, and a way to clear an
// over-narrow filter combination.
function ZeroResultsRecovery({ q, categories, hasFilters }: { q?: string; categories: Category[]; hasFilters: boolean }) {
  const suggestedCategory = q ? findMatchingCategory(categories, q) : null;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center">
      <p className="text-slate-500 dark:text-slate-400">
        {q ? (
          <>
            No places match &ldquo;{q}&rdquo;
            {hasFilters ? ' with these filters' : ''}.
          </>
        ) : (
          'No places match these filters.'
        )}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {suggestedCategory && (
          <Link
            href={`/search?category=${suggestedCategory.slug}`}
            className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
          >
            Browse {suggestedCategory.name}
          </Link>
        )}
        {(q || hasFilters) && (
          <Link
            href="/search"
            className="rounded-full border border-slate-300 dark:border-slate-700 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300"
          >
            Clear search
          </Link>
        )}
      </div>
    </div>
  );
}
