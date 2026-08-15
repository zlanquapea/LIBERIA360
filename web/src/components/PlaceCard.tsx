import Link from 'next/link';
import type { Place } from '@/lib/types';
import { formatDistance, formatPlaceType, formatRating } from '@/lib/format';
import { VerificationBadge } from './VerificationBadge';

export function PlaceCard({ place }: { place: Place }) {
  const distance = formatDistance(place.distanceFromMonroviaKm);

  return (
    <Link
      href={`/places/${place.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div
        aria-hidden
        className="flex h-32 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 text-4xl"
      >
        {place.category.icon ?? '📍'}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{place.name}</h3>
          <VerificationBadge status={place.verificationStatus} />
        </div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          {formatPlaceType(place.type)} · {place.city}, {place.county.name}
        </p>
        <p className="line-clamp-2 text-sm text-slate-600">{place.description}</p>
        <div className="mt-auto flex items-center justify-between pt-1 text-xs text-slate-500">
          <span>{formatRating(place.rating, place.reviewCount)}</span>
          {distance && <span>{distance}</span>}
        </div>
      </div>
    </Link>
  );
}
