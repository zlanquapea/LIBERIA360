import Link from 'next/link';
import { MapPinIcon } from '@heroicons/react/20/solid';
import type { Place, VerificationStatus } from '@/lib/types';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { staggerDelay } from '@/lib/animation';
import { placeLocation } from '@/lib/place-card';
import { InteractiveCard } from './InteractiveCard';
import { SafeImage } from './SafeImage';
import { SaveIconButton } from './SaveIconButton';
import { VerificationSeal } from './VerificationBadge';
import { CategoryChip, OpenNow, PlaceBackdrop, PlaceRating } from './place-card-parts';

// Photo-first discovery tile: the photo fills the card and everything a
// visitor needs to decide (name, trust seal, where, rating, open now) sits
// on a soft shadow at the bottom. Places without a photo get their
// category's woven backdrop in the same shape, so a grid never looks
// broken. `size="feature"` is the large lead tile of a grid (2 columns on
// phones, 2×2 on desktop — see leadsWithFeature). `index` staggers the
// entrance where scroll-driven reveal isn't supported.
export function PlaceCardCompact({
  place,
  verificationStatus,
  index,
  size = 'regular',
}: {
  place: Place;
  verificationStatus?: VerificationStatus;
  index?: number;
  size?: 'regular' | 'feature';
}) {
  const feature = size === 'feature';
  const image = place.images[0];
  const cover = image ? resolveImageUrl(image) : null;
  // The lead tile is wide enough on desktop to need the full photo.
  const coverThumb = image && !feature ? resolveThumbUrl(image) : null;
  const status = verificationStatus ?? place.verificationStatus;

  return (
    <div
      className={`reveal-on-scroll min-w-0 ${feature ? 'col-span-2 lg:row-span-2' : ''}`}
      style={index != null ? staggerDelay(index) : undefined}
    >
      <InteractiveCard
        className={`group relative isolate h-full overflow-hidden rounded-[1.5rem] bg-brand-950 shadow-card ring-1 ring-black/5 dark:ring-white/10 ${
          feature ? 'aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[28rem]' : 'aspect-[4/5]'
        }`}
      >
        <Link
          href={`/places/${place.slug}`}
          className="absolute inset-0 block rounded-[inherit] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sunset-300"
        >
          <SafeImage
            src={cover}
            thumbSrc={coverThumb}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none"
            fallback={<PlaceBackdrop category={place.category} className="transition-transform duration-[900ms] ease-out group-hover:scale-[1.06] motion-reduce:transition-none" />}
          />
          {/* Shade top and bottom so the chip and the text read on any photo. */}
          <span aria-hidden className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/40 to-transparent" />
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

          <div className="absolute start-3 top-3 max-w-[calc(100%-4.5rem)]">
            <CategoryChip category={place.category} />
          </div>

          <div className={`absolute inset-x-0 bottom-0 flex flex-col gap-1.5 text-white ${feature ? 'p-5 sm:p-7' : 'p-3.5 sm:p-4'}`}>
            <h3
              className={`font-display font-bold leading-[1.12] tracking-tight drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)] ${
                feature ? 'text-2xl sm:text-3xl lg:text-4xl' : 'line-clamp-2 text-[15px] sm:text-lg'
              }`}
            >
              {place.name}
              {status && (
                <>
                  {' '}
                  <VerificationSeal status={status} tone="onDark" />
                </>
              )}
            </h3>
            <p className={`flex min-w-0 items-center gap-1 text-white/80 ${feature ? 'text-sm' : 'text-xs'}`}>
              <MapPinIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{placeLocation(place)}</span>
            </p>
            {feature && place.description && (
              <p className="hidden max-w-xl text-sm leading-6 text-white/80 sm:line-clamp-2">{place.description}</p>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <PlaceRating place={place} />
              <OpenNow place={place} />
            </div>
          </div>
        </Link>
        <SaveIconButton slug={place.slug} placeId={place.id} tone="glass" className="absolute end-2.5 top-2.5 z-10" />
      </InteractiveCard>
    </div>
  );
}
