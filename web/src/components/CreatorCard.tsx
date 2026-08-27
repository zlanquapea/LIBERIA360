import Link from 'next/link';
import { CheckBadgeIcon, MapPinIcon, StarIcon } from '@heroicons/react/24/solid';
import type { Creator } from '@/lib/types';
import { colorForCreator, gradientForCategory } from '@/lib/category-colors';
import { formatCreatorCategory, formatRating } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { ContactLink } from './ContactLink';
import { SafeImage } from './SafeImage';
import { ShareMenu } from './ShareMenu';

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
  const messageHref = creator.whatsapp ? whatsappLink(creator.whatsapp) : creator.contactEmail ? `mailto:${creator.contactEmail}` : null;
  const firstName = creator.name.trim().split(/\s+/)[0] || 'creator';

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover dark:bg-slate-900 ${
        creator.featured ? 'border-gold-400' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white text-base font-semibold text-white shadow-sm dark:border-slate-900"
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
        <Link href={profileHref} className="min-w-0 flex-1">
          <h3 className="flex min-w-0 flex-wrap items-center gap-1.5 font-display text-lg font-bold leading-tight text-slate-950 dark:text-slate-50 hover:text-brand-700 dark:hover:text-brand-300">
            <span>{creator.name}</span>
            {creator.verificationStatus === 'verified' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                <CheckBadgeIcon aria-hidden className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span>{formatCreatorCategory(creator.category)}</span>
            {location && (
              <>
                <span aria-hidden>·</span>
                <MapPinIcon aria-hidden className="h-3.5 w-3.5 text-sky-500" />
                <span>{location}</span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">@{creator.username}</p>
        </Link>
        <Link
          href={`${profileHref}#booking`}
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full bg-brand-700 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2"
        >
          Book {firstName}
        </Link>
      </div>

      <Link href={profileHref} aria-label={`View ${creator.name}'s profile`} className="group relative block h-56 overflow-hidden bg-slate-100 dark:bg-slate-800">
        <SafeImage
          src={cover}
          thumbSrc={coverThumb}
          alt=""
          className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallback={<div aria-hidden className="flex h-56 w-full items-center justify-center" style={{ backgroundImage: gradientForCategory(creator.category) }} />}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white">Creator profile</span>
      </Link>

      <div className="flex flex-col gap-3 p-4">
        {creator.bio && <p className="line-clamp-2 text-sm leading-5 text-slate-700 dark:text-slate-200">{creator.bio}</p>}
        {creator.specialties.length > 0 && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{creator.specialties.join(' · ')}</p>}
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          {creator.reviewCount > 0 ? (
            <>
              <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
              {formatRating(creator.rating, creator.reviewCount)}
            </>
          ) : creator.followerCount > 0 ? (
            `${creator.followerCount.toLocaleString()} followers`
          ) : (
            'Explore their work'
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Link
            href={profileHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
          >
            View profile
          </Link>
          {messageHref ? (
            <ContactLink
              creatorId={creator.id}
              href={messageHref}
              target={creator.whatsapp ? '_blank' : undefined}
              rel={creator.whatsapp ? 'noopener noreferrer' : undefined}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
            >
              Message
            </ContactLink>
          ) : (
            <ShareMenu placeName={creator.name} contentType="creator" variant="action" />
          )}
        </div>
        <ShareMenu placeName={creator.name} contentType="creator" variant="action" />
      </div>
    </article>
  );
}
