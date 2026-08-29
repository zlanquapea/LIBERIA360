import Link from 'next/link';
import { TruckIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import type { CarListing } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { formatCarCategory, formatCarTransmission, formatCost } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';

// The discovery card for the /car-rentals directory — same visual
// language as BusinessCard/PlaceCard/CreatorCard (cover image,
// category-colored gradient fallback, hover lift). Only ever rendered for
// an approved, active listing (the directory call site never fetches
// anything else), so no review-status chrome here.
export function CarListingCard({ listing }: { listing: CarListing }) {
  const coverPath = listing.images[0] ?? null;
  const cover = coverPath ? resolveImageUrl(coverPath) : null;
  const coverThumb = coverPath ? resolveThumbUrl(coverPath) : null;
  const location = listing.business?.linkedPlace
    ? `${listing.business.linkedPlace.city}, ${listing.business.linkedPlace.county.name}`
    : null;

  return (
    <Link
      href={`/car-rentals/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="h-32 overflow-hidden">
        <SafeImage
          src={cover}
          thumbSrc={coverThumb}
          alt=""
          className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-110"
          fallback={
            <div
              aria-hidden
              className="flex h-32 items-center justify-center text-4xl transition-transform duration-500 group-hover:scale-110"
              style={{ backgroundImage: gradientForCategory(listing.category) }}
            >
              <TruckIcon className="h-9 w-9 text-white/90" />
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="min-w-0 truncate font-display font-semibold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-300">
          {listing.title}
        </h3>
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {formatCarCategory(listing.category)} · {formatCarTransmission(listing.transmission)}
          {location ? ` · ${location}` : ''}
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <UserGroupIcon aria-hidden className="h-3.5 w-3.5" />
          {listing.seats} seats
          {listing.withDriverAvailable && ' · Driver available'}
        </p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">
            {formatCost(listing.pricePerDay)}
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400"> /day</span>
          </span>
          <span className="text-xs font-medium text-brand-700 dark:text-brand-300">View →</span>
        </div>
      </div>
    </Link>
  );
}
