import Link from 'next/link';
import { CheckBadgeIcon, MapPinIcon, StarIcon } from '@heroicons/react/24/solid';
import type { Creator } from '@/lib/types';
import { colorForCreator, gradientForCategory } from '@/lib/category-colors';
import { formatCreatorCategory, formatRating } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';

// The professional-portfolio card the spec asks for throughout the app
// (directory, and anywhere else a creator gets surfaced) — same visual
// language as PlaceCard (cover image, gradient fallback, hover lift) so a
// creator card reads as part of the same marketplace, not a bolted-on
// social-profile widget.
//
// Star rating shows only once the creator has at least one real review
// (same "no fabricated 0.0 (0)" posture as PlaceCard) — until then,
// follower count (real, self-reported data that's already there) is the
// trust signal shown instead.
export function CreatorCard({ creator }: { creator: Creator }) {
  const cover = creator.coverImage ? resolveImageUrl(creator.coverImage) : null;
  const coverThumb = creator.coverImage ? resolveThumbUrl(creator.coverImage) : null;
  const avatar = creator.profileImage ? resolveImageUrl(creator.profileImage) : null;
  const avatarThumb = creator.profileImage ? resolveThumbUrl(creator.profileImage) : null;
  const location = creator.county?.name ?? creator.locationsCovered[0] ?? null;

  return (
    <Link
      href={`/creators/${creator.username}`}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white dark:bg-slate-900 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover ${
        creator.featured ? 'border-gold-400' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="relative h-28 overflow-hidden">
        <SafeImage
          src={cover}
          thumbSrc={coverThumb}
          alt=""
          className="h-28 w-full object-cover transition-transform duration-500 group-hover:scale-110"
          fallback={
            <div
              aria-hidden
              className="h-28 w-full transition-transform duration-500 group-hover:scale-110"
              style={{ backgroundImage: gradientForCategory(creator.category) }}
            />
          }
        />
        {creator.featured && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-gold-500 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
            <StarIcon aria-hidden className="h-3 w-3" />
            Featured
          </span>
        )}
        <span
          className="absolute -bottom-5 left-3 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white text-base font-semibold text-white shadow-sm dark:border-slate-900"
          style={{ backgroundColor: colorForCreator(creator.username) }}
        >
          <SafeImage
            src={avatar}
            thumbSrc={avatarThumb}
            alt=""
            className="h-full w-full object-cover"
            fallback={<>{creator.name.trim().charAt(0).toUpperCase() || '?'}</>}
          />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3 pt-7">
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex items-center gap-1 truncate font-display font-semibold leading-snug text-slate-900 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-300 dark:hover:text-brand-300">
            {creator.name}
            {creator.verificationStatus === 'verified' && (
              <CheckBadgeIcon aria-label="Verified creator" className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
            )}
          </h3>
        </div>
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {formatCreatorCategory(creator.category)}
          {location && (
            <>
              {' '}
              · <MapPinIcon aria-hidden className="mb-0.5 inline h-3 w-3" /> {location}
            </>
          )}
        </p>
        {creator.bio && <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{creator.bio}</p>}
        {creator.specialties.length > 0 && (
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{creator.specialties.join(' · ')}</p>
        )}
        {creator.reviewCount > 0 && (
          <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
            {formatRating(creator.rating, creator.reviewCount)}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1 text-xs text-slate-500 dark:text-slate-400">
          <span>@{creator.username}</span>
          {creator.followerCount > 0 && <span>{creator.followerCount.toLocaleString()} followers</span>}
        </div>
      </div>
    </Link>
  );
}
