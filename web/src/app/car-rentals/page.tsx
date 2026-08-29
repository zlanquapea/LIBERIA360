import Link from 'next/link';
import { getCarListings, getCounties } from '@/lib/api';
import { CarListingCard } from '@/components/CarListingCard';
import { CarRentalFilters } from '@/components/CarRentalFilters';
import type { CarCategory, CarTransmission } from '@/lib/types';

export const metadata = { title: 'Car Rentals — LIBERIA360' };

type SearchParams = { [key: string]: string | string[] | undefined };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Car rental directory — every approved, active vehicle listed by a
// car-rental Business. Same structure as the Businesses directory:
// filters, a card grid, pagination.
export default async function CarRentalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Number(first(params.page) ?? '1') || 1;
  const search = first(params.search);
  const category = first(params.category) as CarCategory | undefined;
  const transmission = first(params.transmission) as CarTransmission | undefined;
  const countyId = first(params.countyId);
  const minSeats = first(params.minSeats) ? Number(first(params.minSeats)) : undefined;
  const maxPricePerDay = first(params.maxPricePerDay) ? Number(first(params.maxPricePerDay)) : undefined;
  const withDriverAvailable = first(params.withDriverAvailable) === 'true';

  const [counties, result] = await Promise.all([
    getCounties(),
    getCarListings({
      page,
      limit: 20,
      search,
      category,
      transmission,
      countyId,
      minSeats,
      maxPricePerDay,
      withDriverAvailable: withDriverAvailable || undefined,
    }),
  ]);

  function pageHref(targetPage: number) {
    const p = new URLSearchParams();
    if (search) p.set('search', search);
    if (category) p.set('category', category);
    if (transmission) p.set('transmission', transmission);
    if (countyId) p.set('countyId', countyId);
    if (minSeats) p.set('minSeats', String(minSeats));
    if (maxPricePerDay) p.set('maxPricePerDay', String(maxPricePerDay));
    if (withDriverAvailable) p.set('withDriverAvailable', 'true');
    p.set('page', String(targetPage));
    return `/car-rentals?${p.toString()}`;
  }

  const hasFilters = Boolean(
    search || category || transmission || countyId || minSeats || maxPricePerDay || withDriverAvailable,
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Car Rentals</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Hire a car to get around Liberia on your own schedule — with or without a driver. Own a
          fleet?{' '}
          <Link href="/account/my-car-listings" className="font-medium text-brand-700 dark:text-brand-300 hover:underline">
            List your vehicles
          </Link>
          .
        </p>
      </div>

      <CarRentalFilters counties={counties} />

      {result.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
          {hasFilters ? 'No vehicles match these filters.' : 'No approved car listings yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((listing) => (
            <CarListingCard key={listing.id} listing={listing} />
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
