import Link from "next/link";
import {
  CheckBadgeIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import type { Creator } from "@/lib/types";
import { colorForCreator, gradientForCategory } from "@/lib/category-colors";
import { formatCreatorCategory, formatRating } from "@/lib/format";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import { whatsappLink } from "@/lib/contact";
import { ContactLink } from "./ContactLink";
import { SafeImage } from "./SafeImage";
import { ShareMenu } from "./ShareMenu";

// Compact social-style creator preview for the public directory. The card uses
// only data available on the paginated creator response; full portfolio media
// and request booking remain on the creator profile.
export function CreatorCard({ creator }: { creator: Creator }) {
  const cover = creator.coverImage ? resolveImageUrl(creator.coverImage) : null;
  const coverThumb = creator.coverImage
    ? resolveThumbUrl(creator.coverImage)
    : null;
  const avatar = creator.profileImage
    ? resolveImageUrl(creator.profileImage)
    : null;
  const avatarThumb = creator.profileImage
    ? resolveThumbUrl(creator.profileImage)
    : null;
  const location = creator.county?.name ?? creator.locationsCovered[0] ?? null;
  const profileHref = `/creators/${creator.username}`;
  const messageHref = creator.whatsapp
    ? whatsappLink(creator.whatsapp)
    : creator.contactEmail
      ? `mailto:${creator.contactEmail}`
      : null;

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow duration-200 hover:shadow-card-hover dark:bg-slate-900 ${
        creator.featured
          ? "border-gold-400 dark:border-gold-500"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <Link
          href={profileHref}
          aria-label={`View ${creator.name}'s profile`}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white text-base font-semibold text-white shadow-sm ring-1 ring-slate-200 dark:border-slate-900 dark:ring-slate-700"
          style={{ backgroundColor: colorForCreator(creator.username) }}
        >
          <SafeImage
            src={avatar}
            thumbSrc={avatarThumb}
            alt=""
            className="h-full w-full object-cover"
            fallback={<>{creator.name.trim().charAt(0).toUpperCase() || "?"}</>}
          />
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={profileHref} className="group block min-w-0">
            <h3 className="flex min-w-0 flex-wrap items-center gap-1.5 font-display text-lg font-bold leading-tight text-slate-950 group-hover:text-brand-700 dark:text-slate-50 dark:group-hover:text-brand-300">
              <span className="truncate">{creator.name}</span>
              {creator.verificationStatus === "verified" && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white"
                  title="Verified creator"
                >
                  <CheckBadgeIcon aria-hidden className="h-3.5 w-3.5" />
                  <span className="sr-only">Verified creator</span>
                </span>
              )}
            </h3>
            <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>{formatCreatorCategory(creator.category)}</span>
              {location && (
                <>
                  <span aria-hidden>·</span>
                  <MapPinIcon
                    aria-hidden
                    className="h-3.5 w-3.5 shrink-0 text-sky-500"
                  />
                  <span className="truncate">{location}</span>
                </>
              )}
            </p>
          </Link>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
            @{creator.username}
          </p>
        </div>
      </div>

      <Link
        href={profileHref}
        aria-label={`Open ${creator.name}'s profile`}
        className="group relative block h-44 overflow-hidden bg-slate-100 dark:bg-slate-800 sm:h-48"
      >
        <SafeImage
          src={cover}
          thumbSrc={coverThumb}
          alt=""
          className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] sm:h-48"
          fallback={
            <div
              aria-hidden
              className="flex h-full w-full items-center justify-center"
              style={{ backgroundImage: gradientForCategory(creator.category) }}
            />
          }
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/5"
        />
      </Link>

      <div className="flex flex-col gap-3 p-4 pt-3">
        {creator.bio ? (
          <p className="line-clamp-2 text-sm leading-5 text-slate-700 dark:text-slate-200">
            {creator.bio}
          </p>
        ) : creator.specialties.length > 0 ? (
          <p className="line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {creator.specialties.join(" · ")}
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Explore their work on LIBERIA360.
          </p>
        )}

        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          {creator.reviewCount > 0 ? (
            <>
              <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
              {formatRating(creator.rating, creator.reviewCount)}
            </>
          ) : creator.followerCount > 0 ? (
            `${creator.followerCount.toLocaleString()} followers`
          ) : (
            "New creator"
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Link
            href={profileHref}
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            View profile
          </Link>
          {messageHref && (
            <ContactLink
              creatorId={creator.id}
              href={messageHref}
              target={creator.whatsapp ? "_blank" : undefined}
              rel={creator.whatsapp ? "noopener noreferrer" : undefined}
              className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30"
            >
              Message
            </ContactLink>
          )}
          <ShareMenu placeName={creator.name} contentType="creator" />
        </div>
      </div>
    </article>
  );
}
