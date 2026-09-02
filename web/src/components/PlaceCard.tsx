import Link from 'next/link';
import { StarIcon, MapPinIcon } from '@heroicons/react/20/solid';
import type { Place } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { formatCost, formatDistance, formatPlaceType, formatRating } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { staggerDelay } from '@/lib/animation';
import { VerificationBadge } from './VerificationBadge';
import { SafeImage } from './SafeImage';
import { SaveIconButton } from './SaveIconButton';

// `distanceOverride` lets a caller show a more relevant distance than the
// catalog's fixed distanceFromMonroviaKm — e.g. Near Me results show
// distance from the searched point instead. `index` is this card's
// position in its list — when a caller passes it, the card fades/lifts
// into place with a small stagger instead of appearing instantly (see
// lib/animation.ts); omit it for a lone card (e.g. a single related-place
// callout) where there's no list rhythm to be part of. `distanceOutsideRadius`
// flags a distance that's actually farther than what the caller searched for
// (Near Me's "nothing nearby, here's what's closest in Liberia" fallback) —
// styled distinctly (gold, not the muted default) so it can't be mistaken
// for a place that genuinely matched the selected radius.
export function PlaceCard({
  place,
  distanceOverride,
  distanceOutsideRadius,
  index,
}: {
  place: Place;
  distanceOverride?: string | null;
  distanceOutsideRadius?: boolean;
  index?: number;
}) {
  const distance = distanceOverride ?? formatDistance(place.distanceFromMonroviaKm);
  // Cards only have Place.images, not the linked Business's own photos —
  // fetching a business per card would mean an extra request per list
  // item. The full destination profile shows both; the card is just a
  // preview, so this falls back to the category placeholder same as before
  // for a listing that hasn't had a place-level photo set yet.
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
  const coverThumb = place.images[0] ? resolveThumbUrl(place.images[0]) : null;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98] ${index != null ? 'animate-fade-in-up' : ''}`}
      style={index != null ? staggerDelay(index) : undefined}
    >
      <SaveIconButton slug={place.slug} placeId={place.id} className="absolute right-2 top-2 z-10" />
      <Link href={`/places/${place.slug}`} className="flex flex-col">
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
                style={{ backgroundImage: gradientForCategory(place.category.slug) }}
              >
                <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-9 w-9 text-white/90" />
              </div>
            }
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-semibold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-300 dark:hover:text-brand-300">
              {place.name}
            </h3>
            <VerificationBadge status={place.verificationStatus} />
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {formatPlaceType(place.type)} · {place.city}, {place.county.name}
          </p>
          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{place.description}</p>
          <div className="mt-auto flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              {place.reviewCount > 0 && <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />}
              {formatRating(place.rating, place.reviewCount)}
            </span>
            <span className="flex items-center gap-2">
              {place.estimatedCostEntry != null && <span>{formatCost(place.estimatedCostEntry)}</span>}
              {distance && (
                <span
                  className={
                    distanceOutsideRadius
                      ? 'flex items-center gap-0.5 rounded-full bg-gold-100 px-1.5 py-0.5 font-semibold text-gold-800 dark:bg-gold-900/40 dark:text-gold-300'
                      : 'flex items-center gap-0.5'
                  }
                >
                  <MapPinIcon
                    aria-hidden
                    className={`h-3.5 w-3.5 ${distanceOutsideRadius ? 'text-gold-600 dark:text-gold-400' : 'text-slate-400 dark:text-slate-400'}`}
                  />
                  {distance}
                </span>
              )}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
