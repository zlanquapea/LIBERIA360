import Link from 'next/link';
import { getBusinesses, getCounties } from '@/lib/api';
import { BusinessCard } from '@/components/BusinessCard';
import { BusinessFilters } from '@/components/BusinessFilters';
import type { BusinessType } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';

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
    <main className="page-shell max-w-6xl">
      <PageHeader eyebrow="Local directory" title="Businesses" description={<>
          Hotels, restaurants, tour operators, and other local businesses across Liberia. Own one?
          Find it on its destination page to claim the listing.
        </>} />

      <BusinessFilters counties={counties} />

      {result.data.length === 0 ? (
        <p className="empty-state">
          {hasFilters ? 'No businesses match these filters.' : 'No approved business listings yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((business, i) => (
            <BusinessCard key={business.id} business={business} index={i} />
          ))}
        </div>
      )}

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
