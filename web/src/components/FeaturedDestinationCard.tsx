import Link from 'next/link';
import { ChevronRightIcon, MapPinIcon } from '@heroicons/react/24/solid';
import type { Place, VerificationStatus } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { resolveImageUrl } from '@/lib/images';
import { CategoryIcon } from '@/lib/icons';
import { SafeImage } from './SafeImage';
import { VerificationBadge } from './VerificationBadge';

// A consistent editorial card for Home's paid featured-placement grid.
// A single Link wraps the card; the Explore affordance stays decorative,
// avoiding nested interactive elements while keeping a generous tap target.
export function FeaturedDestinationCard({ place, verificationStatus }: { place: Place; verificationStatus?: VerificationStatus }) {
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;

  return (
    <Link
      href={`/places/${place.slug}`}
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-600"
    >
      <div className="aspect-[16/10] overflow-hidden bg-slate-200 dark:bg-slate-800">
        <SafeImage
          src={cover}
          alt={cover ? place.name : ''}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallback={<div aria-hidden className="flex h-full items-center justify-center" style={{ backgroundImage: gradientForCategory(place.category.slug) }}><CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-14 w-14 text-white/80" /></div>}
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold leading-tight text-slate-900 dark:text-white">
          <span>{place.name}</span>
          <VerificationBadge status={verificationStatus ?? place.verificationStatus} />
        </h3>
        <p className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400"><MapPinIcon aria-hidden className="h-4 w-4" />{place.city}, {place.county.name}</p>
        <p className="line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{place.description}</p>
        <span className="mt-auto inline-flex w-fit items-center gap-1 pt-1 text-sm font-bold text-brand-700 dark:text-brand-300">
          Explore
          <ChevronRightIcon aria-hidden className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
