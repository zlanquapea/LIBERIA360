import Link from 'next/link';
import { BuildingStorefrontIcon, MapPinIcon } from '@heroicons/react/24/solid';
import type { Business } from '@/lib/types';
import { gradientForCategory } from '@/lib/category-colors';
import { formatBusinessType } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { VerificationBadge } from './VerificationBadge';
import { SafeImage } from './SafeImage';

// The discovery card for the Business directory and anywhere else a
// business surfaces — same visual language as PlaceCard/CreatorCard (cover
// image, category-colored gradient fallback, hover lift) so a business
// reads as part of the same marketplace rather than a bolted-on listing
// type. Only ever rendered for an APPROVED business (the directory/card
// call sites never fetch anything else), so no review-status chrome here —
// that belongs to the owner-facing claim/edit views, not a public card.
export function BusinessCard({ business }: { business: Business }) {
  const cover = business.logoImage
    ? resolveImageUrl(business.logoImage)
    : business.images[0]
      ? resolveImageUrl(business.images[0])
      : null;
  const location = `${business.linkedPlace.city}, ${business.linkedPlace.county.name}`;

  return (
    <Link
      href={`/businesses/${business.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <div className="h-32 overflow-hidden">
        <SafeImage
          src={cover}
          alt=""
          className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-110"
          fallback={
            <div
              aria-hidden
              className="flex h-32 items-center justify-center text-4xl transition-transform duration-500 group-hover:scale-110"
              style={{ backgroundImage: gradientForCategory(business.type) }}
            >
              <BuildingStorefrontIcon className="h-9 w-9 text-white/90" />
            </div>
          }
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-semibold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-brand-700">
            {business.name}
          </h3>
          <VerificationBadge status={business.verificationStatus} />
        </div>
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {formatBusinessType(business.type)} · {location}
        </p>
        {business.description && (
          <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{business.description}</p>
        )}
        <div className="mt-auto flex items-center gap-1 pt-1 text-xs font-medium text-brand-700">
          <MapPinIcon aria-hidden className="h-3.5 w-3.5" />
          View listing
        </div>
      </div>
    </Link>
  );
}
