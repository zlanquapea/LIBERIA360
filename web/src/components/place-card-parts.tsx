import { useTranslations } from 'next-intl';
import { StarIcon } from '@heroicons/react/20/solid';
import type { Category, Place } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { CategoryIcon } from '@/lib/icons';
import { isOpenAt } from '@/lib/opening-hours';
import { shortCategory } from '@/lib/place-card';

type Tone = 'onDark' | 'onLight';

/** Frosted chip naming the category, over the top of a photo. */
export function CategoryChip({ category }: { category: Pick<Category, 'name' | 'slug' | 'icon'> }) {
  return (
    <span
      title={category.name}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/30 py-1 pe-2.5 ps-2 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-md"
    >
      <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{shortCategory(category.name)}</span>
    </span>
  );
}

/** "★ 4.3 (3)" for a reviewed place, or a warm "New" for one nobody has
 * reviewed yet, which says what's true without counting against it. */
export function PlaceRating({ place, tone = 'onDark' }: { place: Pick<Place, 'rating' | 'reviewCount'>; tone?: Tone }) {
  const t = useTranslations('placeCard');
  if (place.reviewCount > 0) {
    const rating = Number(place.rating).toFixed(1);
    return (
      <span
        role="img"
        aria-label={t('ratingLabel', { rating, count: place.reviewCount })}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
          tone === 'onDark'
            ? 'bg-white/15 text-white ring-1 ring-white/20 backdrop-blur-sm'
            : 'bg-gold-50 text-slate-900 ring-1 ring-gold-200 dark:bg-gold-900/30 dark:text-slate-50 dark:ring-gold-800'
        }`}
      >
        <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-400" />
        {rating}
        <span className={`font-medium ${tone === 'onDark' ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>({place.reviewCount})</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-sunset-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
      {t('new')}
    </span>
  );
}

/** A live green "Open now" when the place's structured hours say so. */
export function OpenNow({ place, tone = 'onDark' }: { place: Pick<Place, 'structuredHours'>; tone?: Tone }) {
  const t = useTranslations('placeCard');
  if (!place.structuredHours?.length || !isOpenAt(place.structuredHours, new Date())) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${tone === 'onDark' ? 'text-emerald-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
      <span aria-hidden className="relative flex h-2 w-2">
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden [animation-iteration-count:3]" />
        <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      {t('openNow')}
    </span>
  );
}

/** What a place without a photo shows: its category's woven colour with
 * the category icon as a large watermark, so it looks intentional and
 * keeps the same shape as every other card. */
export function PlaceBackdrop({ category, className = '' }: { category: Pick<Category, 'slug' | 'icon'>; className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden ${className}`} style={{ backgroundImage: gradientForCategory(category.slug) }}>
      <CategoryIcon
        iconKey={category.icon}
        categorySlug={category.slug}
        className="absolute -end-[12%] top-[18%] h-[78%] w-[78%] rotate-[-12deg] text-white/[0.14]"
      />
    </div>
  );
}
