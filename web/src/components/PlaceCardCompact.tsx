import Link from 'next/link';
import { StarIcon } from '@heroicons/react/20/solid';
import type { Place } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { formatRating } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';
import { SaveIconButton } from './SaveIconButton';
import { VerificationBadge } from './VerificationBadge';

// Compact grid card for Home's "Trending places" — just image, name,
// city/town, category (in the same green used for the "Sponsored" and
// discovery accents elsewhere), and rating. The fuller `PlaceCard`
// (description, price, distance, verification badge) stays in use on
// search/category/county listing pages, where that extra context is worth
// the space; this one is deliberately terser so two can sit side by side
// even on a narrow phone screen.
export function PlaceCardCompact({ place }: { place: Place }) {
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
  const coverThumb = place.images[0] ? resolveThumbUrl(place.images[0]) : null;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-800 dark:bg-slate-900">
      <SaveIconButton slug={place.slug} placeId={place.id} className="absolute right-1.5 top-1.5 z-10" />
      <Link href={`/places/${place.slug}`} className="flex flex-col">
        <div className="h-32 overflow-hidden">
          <SafeImage
            src={cover}
            thumbSrc={coverThumb}
            alt=""
            className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            fallback={
              <div
                aria-hidden
                className="flex h-32 items-center justify-center text-4xl transition-transform duration-500 group-hover:scale-105"
                style={{ backgroundImage: gradientForCategory(place.category.slug) }}
              >
                <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-8 w-8 text-white/90" />
              </div>
            }
          />
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <h3 className="flex min-w-0 flex-wrap items-center gap-1 font-display text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-300">
            <span className="min-w-0 truncate">{place.name}</span>
            <VerificationBadge status={place.verificationStatus} />
          </h3>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {place.city}, {place.county.name}
          </p>
          <p className="truncate text-xs font-medium uppercase tracking-wide text-accent-600 dark:text-accent-400">
            {place.category.name}
          </p>
          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {place.reviewCount > 0 && <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />}
            {formatRating(place.rating, place.reviewCount)}
          </span>
        </div>
      </Link>
    </div>
  );
}
