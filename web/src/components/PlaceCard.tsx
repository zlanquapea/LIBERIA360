import Link from 'next/link';
import type { Place } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { formatDistance, formatPlaceType, formatRating } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { VerificationBadge } from './VerificationBadge';

// `distanceOverride` lets a caller show a more relevant distance than the
// catalog's fixed distanceFromMonroviaKm — e.g. Near Me results show
// distance from the searched point instead.
export function PlaceCard({ place, distanceOverride }: { place: Place; distanceOverride?: string | null }) {
  const distance = distanceOverride ?? formatDistance(place.distanceFromMonroviaKm);
  // Cards only have Place.images, not the linked Business's own photos —
  // fetching a business per card would mean an extra request per list
  // item. The full destination profile shows both; the card is just a
  // preview, so this falls back to the category placeholder same as before
  // for a listing that hasn't had a place-level photo set yet.
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;

  return (
    <Link
      href={`/places/${place.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" className="h-32 w-full object-cover" />
      ) : (
        <div
          aria-hidden
          className="flex h-32 items-center justify-center text-4xl"
          style={{ backgroundImage: gradientForCategory(place.category.slug) }}
        >
          {place.category.icon ?? '📍'}
        </div>
      )}
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
