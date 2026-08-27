import Link from 'next/link';
import { CheckBadgeIcon, MapPinIcon, StarIcon } from '@heroicons/react/24/solid';
import type { Creator } from '@/lib/types';
import { colorForCreator, gradientForCategory } from '@/lib/category-colors';
import { formatCreatorCategory, formatRating } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';

// Social-style creator preview for the public directory. It intentionally
// uses only data available on the paginated creator response; full portfolio
// media remains on the creator profile where it can be viewed safely.
export function CreatorCard({ creator }: { creator: Creator }) {
  const cover = creator.coverImage ? resolveImageUrl(creator.coverImage) : null;
  const coverThumb = creator.coverImage ? resolveThumbUrl(creator.coverImage) : null;
  const avatar = creator.profileImage ? resolveImageUrl(creator.profileImage) : null;
  const avatarThumb = creator.profileImage ? resolveThumbUrl(creator.profileImage) : null;
  const location = creator.county?.name ?? creator.locationsCovered[0] ?? null;
  const profileHref = `/creators/${creator.username}`;

  return (
    <article
      className={`group overflow-hidden rounded-3xl border bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-slate-900 ${
        creator.featured ? 'border-gold-400' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <Link href={profileHref} className="block">
        <div className="relative h-44 overflow-hidden">
          <SafeImage
            src={cover}
            thumbSrc={coverThumb}
            alt=""
            className="h-44 w-full object-cover transition-transform duration-500 group-hover:scale-105"
            fallback={
              <div
                aria-hidden
                className="flex h-44 w-full items-center justify-center"
                style={{ backgroundImage: gradientForCategory(creator.category) }}
              />
            }
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
          {creator.featured && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-gold-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
              <StarIcon aria-hidden className="h-3.5 w-3.5" />
              Featured
            </span>
          )}
          <span
            className="absolute -bottom-6 left-4 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white text-lg font-semibold text-white shadow-sm dark:border-slate-900"
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

        <div className="flex flex-col gap-2 p-4 pt-9">
          <h3 className="flex min-w-0 flex-wrap items-center gap-1.5 font-display text-xl font-bold leading-tight text-slate-950 dark:text-slate-50 group-hover:text-brand-700 dark:group-hover:text-brand-300">
            <span>{creator.name}</span>
            {creator.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                <CheckBadgeIcon aria-hidden className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </h3>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {formatCreatorCategory(creator.category)}
            {location && (
              <>
                <span aria-hidden>·</span>
                <MapPinIcon aria-hidden className="h-3.5 w-3.5 text-sky-500" />
                {location}
              </>
            )}
          </p>
          {creator.bio && <p className="line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">{creator.bio}</p>}
          {creator.specialties.length > 0 && (
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{creator.specialties.join(' · ')}</p>
          )}
          <div className="flex items-center justify-between gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>@{creator.username}</span>
            {creator.reviewCount > 0 ? (
              <span className="flex items-center gap-1">
                <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
                {formatRating(creator.rating, creator.reviewCount)}
              </span>
            ) : creator.followerCount > 0 ? (
              <span>{creator.followerCount.toLocaleString()} followers</span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <Link
          href={profileHref}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
        >
          View profile
        </Link>
        <Link
          href={`${profileHref}#booking`}
          className="inline-flex min-h-10 items-center justify-center rounded-full bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
        >
          Book creator
        </Link>
      </div>
    </article>
  );
}
