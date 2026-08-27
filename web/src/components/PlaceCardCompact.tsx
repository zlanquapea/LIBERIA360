import Link from 'next/link';
import { ClockIcon, PhoneIcon, ShieldCheckIcon, TagIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/20/solid';
import type { Place } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { formatRating } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';
import { SaveIconButton } from './SaveIconButton';

// Compact homepage card with a small trust strip. Every signal below is
// derived from the Place response; missing data is omitted rather than
// presented as an invented fact.
export function PlaceCardCompact({ place }: { place: Place }) {
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
  const coverThumb = place.images[0] ? resolveThumbUrl(place.images[0]) : null;
  const hasHours = Boolean(place.openingHours);
  const hasContact = Boolean(place.contactPhone || place.whatsapp || place.website);
  const hasPrice = place.estimatedCostEntry != null || place.estimatedCostGuide != null || place.estimatedCostTransport != null;
  const isVerified = place.verificationStatus !== 'unverified';

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
          <h3 className="truncate font-display text-sm font-semibold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-300">
            {place.name}
          </h3>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {place.city}, {place.county.name}
          </p>
          <p className="truncate text-xs font-medium uppercase tracking-wide text-accent-600 dark:text-accent-400">
            {place.category.name}
          </p>
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] leading-tight text-slate-500 dark:text-slate-400">
            {hasHours && (
              <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300">
                <ClockIcon aria-hidden className="h-3 w-3" />
                Hours available
              </span>
            )}
            {hasContact && (
              <span className="inline-flex items-center gap-0.5 text-brand-700 dark:text-brand-300">
                <PhoneIcon aria-hidden className="h-3 w-3" />
                Contact available
              </span>
            )}
            {hasPrice && (
              <span className="inline-flex items-center gap-0.5 text-orange-700 dark:text-orange-300">
                <TagIcon aria-hidden className="h-3 w-3" />
                Price available
              </span>
            )}
            <span className={`inline-flex items-center gap-0.5 ${isVerified ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
              <ShieldCheckIcon aria-hidden className="h-3 w-3" />
              {isVerified ? 'Verified' : 'Not verified'}
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {place.reviewCount > 0 && <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />}
            {formatRating(place.rating, place.reviewCount)}
          </span>
        </div>
      </Link>
    </div>
  );
}
