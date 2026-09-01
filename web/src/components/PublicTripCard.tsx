import Link from 'next/link';
import { MapPinIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import type { PublicTripSummary } from '@/lib/types';
import { formatTripDateRange, formatTripStatus } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { gradientForCategory } from '@/lib/category-colors';
import { SafeImage } from './SafeImage';

// A community-discoverable public trip (Sections 5/17 of the Aug 2026
// social-trip spec) — mirrors PlaceCard's shape (cover image, tap-through,
// key facts row) since a trip card lives in the same kind of grid.
export function PublicTripCard({ trip }: { trip: PublicTripSummary }) {
  const cover = trip.coverImage ? resolveImageUrl(trip.coverImage) : null;
  const coverThumb = trip.coverImage ? resolveThumbUrl(trip.coverImage) : null;
  const dateRange = formatTripDateRange(trip.startDate, trip.endDate);

  return (
    <Link
      href={`/trips/${trip.id}`}
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
              className="flex h-32 items-center justify-center text-4xl"
              style={{ backgroundImage: gradientForCategory(trip.destination?.category.slug ?? 'default') }}
            >
              <MapPinIcon className="h-9 w-9 text-white/90" />
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-300">
            {trip.title}
          </h3>
          <span className="shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            {formatTripStatus(trip.status)}
          </span>
        </div>
        {trip.destination && (
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <MapPinIcon aria-hidden className="h-3.5 w-3.5" />
            {trip.destination.name}
          </p>
        )}
        {trip.description && <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{trip.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <UserGroupIcon aria-hidden className="h-3.5 w-3.5" />
            {trip.participantCount} going
          </span>
          {dateRange && <span>{dateRange}</span>}
        </div>
        {trip.admin && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Organized by {trip.admin.name}</p>
        )}
      </div>
    </Link>
  );
}
