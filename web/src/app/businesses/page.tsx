import Link from 'next/link';
import { getBusinesses, getCounties } from '@/lib/api';
import { BusinessCard } from '@/components/BusinessCard';
import { BusinessFilters } from '@/components/BusinessFilters';
import type { BusinessType } from '@/lib/types';

export const metadata = { title: 'Businesses — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Business directory — hotels, restaurants, tour operators, and every
// other tourism-economy business type that's claimed and been approved.
// Same structure as the Creator directory (/creators): filters, a card
// grid, pagination.
export default async function BusinessesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? '1') || 1;
  const search = first(params.search);
  const type = first(params.type) as BusinessType | undefined;
  const countyId = first(params.countyId);

  const [counties, result] = await Promise.all([
    getCounties(),
    getBusinesses({ page, limit: 20, search, type, countyId }),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (type) p.set('type', type);
    if (countyId) p.set('countyId', countyId);
    p.set('page', String(targetPage));
    return `/businesses?${p.toString()}`;
  }

  const hasFilters = Boolean(search || type || countyId);

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Businesses</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Hotels, restaurants, tour operators, and other local businesses across Liberia. Own one?
          Find it on its destination page to claim the listing.
        </p>
      </div>

      <BusinessFilters counties={counties} />

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          {hasFilters ? 'No businesses match these filters.' : 'No approved business listings yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>
      )}

      {result.meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Link
            href={pageHref(page - 1)}
            aria-disabled={page <= 1}
            className={`text-sm font-medium ${page <= 1 ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 hover:underline'}`}
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
              page >= result.meta.totalPages ? 'pointer-events-none text-slate-300 dark:text-slate-700' : 'text-brand-700 hover:underline'
            }`}
          >
            Next →
          </Link>
        </div>
      )}
    </main>
  );
}
