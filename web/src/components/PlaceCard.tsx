import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { MapPinIcon } from '@heroicons/react/20/solid';
import type { Place } from '@/lib/types';
import { formatCost, formatDistance } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { staggerDelay } from '@/lib/animation';
import { placeLocation } from '@/lib/place-card';
import { InteractiveCard } from './InteractiveCard';
import { VerificationSeal } from './VerificationBadge';
import { SafeImage } from './SafeImage';
import { SaveIconButton } from './SaveIconButton';
import { CategoryChip, OpenNow, PlaceBackdrop, PlaceRating } from './place-card-parts';

// The listing card for search, category, county, saved and Near Me
// results: the same photo-first look as PlaceCardCompact on top, with
// room underneath for a short description, the entry price and distance.
// `distanceOverride` shows a more relevant distance than the catalog's
// distance from Monrovia (Near Me uses distance from the searched point).
// `distanceOutsideRadius` marks a place farther than what was searched
// (Near Me's "closest we have" fallback) in gold so it isn't mistaken for
// a match. `index` staggers the entrance where scroll-driven reveal isn't
// supported.
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
  const t = useTranslations('placeCard');
  const distance = distanceOverride ?? formatDistance(place.distanceFromMonroviaKm);
  // Cards only have Place.images, not the linked business's photos: a
  // request per card would be too many. The profile page shows both.
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
  const coverThumb = place.images[0] ? resolveThumbUrl(place.images[0]) : null;
  const price =
    place.estimatedCostEntry == null
      ? null
      : place.estimatedCostEntry === 0
        ? t('free')
        : t('entry', { price: formatCost(place.estimatedCostEntry) });

  return (
    <div className="reveal-on-scroll h-full min-w-0" style={index != null ? staggerDelay(index) : undefined}>
      <InteractiveCard className="group relative isolate flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <Link
          href={`/places/${place.slug}`}
          className="flex h-full flex-col rounded-[inherit] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sunset-300"
        >
          <div className="relative aspect-[16/10] overflow-hidden bg-brand-950">
            <SafeImage
              src={cover}
              thumbSrc={coverThumb}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
              fallback={<PlaceBackdrop category={place.category} className="transition-transform duration-[900ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none" />}
            />
            <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/40 to-transparent" />
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute start-3 top-3 max-w-[calc(100%-4.5rem)]">
              <CategoryChip category={place.category} />
            </div>
            <div className="absolute bottom-3 start-3 flex items-center gap-2">
              <PlaceRating place={place} />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1.5 p-4">
            <h3 className="font-display text-lg font-bold leading-snug tracking-tight text-slate-950 transition-colors group-hover:text-brand-700 dark:text-slate-50 dark:group-hover:text-brand-300">
              {place.name}
              {place.verificationStatus && (
                <>
                  {' '}
                  <VerificationSeal status={place.verificationStatus} />
                </>
              )}
            </h3>
            <p className="flex min-w-0 items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              <MapPinIcon aria-hidden className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{placeLocation(place)}</span>
            </p>
            {place.description && <p className="line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{place.description}</p>}
            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <OpenNow place={place} tone="onLight" />
              {price && <span>{price}</span>}
              {distance && (
                <span
                  className={`ms-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                    distanceOutsideRadius
                      ? 'bg-gold-100 font-semibold text-gold-800 dark:bg-gold-900/40 dark:text-gold-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {distance}
                </span>
              )}
            </div>
          </div>
        </Link>
        <SaveIconButton slug={place.slug} placeId={place.id} tone="glass" className="absolute end-2.5 top-2.5 z-10" />
      </InteractiveCard>
    </div>
  );
}
