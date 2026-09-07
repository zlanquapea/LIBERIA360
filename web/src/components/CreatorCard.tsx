import Link from "next/link";
import {
  CheckBadgeIcon,
  ChatBubbleOvalLeftIcon,
  MapPinIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import type { Creator } from "@/lib/types";
import { colorForCreator } from "@/lib/category-colors";
import { formatCreatorCategory, formatRating } from "@/lib/format";
import { resolveImageUrl, resolveThumbUrl } from "@/lib/images";
import { whatsappLink } from "@/lib/contact";
import { staggerDelay } from "@/lib/animation";
import { ContactLink } from "./ContactLink";
import { SafeImage } from "./SafeImage";
import { ShareMenu } from "./ShareMenu";

// LinkedIn-style compact search-result row for the public creator directory
// (redesign, Sep 2026 — "the page where we search for creators is not well
// organized, make it like LinkedIn"). The previous card spent most of its
// height on a decorative cover photo, so a phone screen showed barely one
// full profile at a time with no real sense of how many results existed.
// This drops the cover photo and per-card box (border/shadow) in favor of
// the dense list pattern LinkedIn's own people-search results use: a small
// circular avatar, a stacked name/headline/stat block, a slim divider
// between rows, and a "View profile" + message action pair — closer to
// scanning a results list than swiping through profile cards. `index`
// still staggers the entrance fade, same recipe as every sibling
// discovery card (see staggerDelay's own doc comment).
export function CreatorCard({ creator, index }: { creator: Creator; index?: number }) {
  const avatar = creator.profileImage ? resolveImageUrl(creator.profileImage) : null;
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
  // A one-line "headline" under the category/location, the way LinkedIn
  // shows a person's current role — only rendered when there's real
  // content, unlike the old card's "Explore their work…" filler text.
  const headline = creator.bio?.trim() || creator.specialties.slice(0, 3).join(" · ") || null;

  return (
    <article
      className={`flex gap-3 border-b border-slate-100 py-4 last:border-b-0 dark:border-slate-800 ${index != null ? "animate-fade-in-up" : ""}`}
      style={index != null ? staggerDelay(index) : undefined}
    >
      <Link
        href={profileHref}
        aria-label={`View ${creator.name}'s profile`}
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-semibold text-white ring-1 ring-slate-200 dark:ring-slate-700"
        style={{ backgroundColor: colorForCreator(creator.username) }}
      >
        <SafeImage
          src={avatar}
          thumbSrc={avatarThumb}
          alt=""
          className="h-full w-full object-cover"
          fallback={<>{creator.name.trim().charAt(0).toUpperCase() || "?"}</>}
        />
        {creator.featured && (
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold-400 text-brand-950 ring-2 ring-white dark:ring-slate-950"
          >
            <StarIcon className="h-3 w-3" />
          </span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <Link href={profileHref} className="group block min-w-0">
          <h3 className="flex min-w-0 items-center gap-1 font-display text-base font-bold leading-tight text-slate-950 group-hover:text-brand-700 dark:text-slate-50 dark:group-hover:text-brand-300">
            <span className="truncate">{creator.name}</span>
            {creator.verificationStatus === "verified" && (
              <CheckBadgeIcon
                aria-hidden
                className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400"
              />
            )}
            {creator.verificationStatus === "verified" && (
              <span className="sr-only">Verified creator</span>
            )}
          </h3>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-sm text-slate-600 dark:text-slate-300">
            <span>{formatCreatorCategory(creator.category)}</span>
            {location && (
              <>
                <span aria-hidden>·</span>
                <MapPinIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                <span className="truncate">{location}</span>
              </>
            )}
          </p>
          {headline && (
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
              {headline}
            </p>
          )}
        </Link>

        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          {creator.reviewCount > 0 ? (
            <>
              <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
              {formatRating(creator.rating, creator.reviewCount)}
            </>
          ) : creator.followerCount > 0 ? (
            `${creator.followerCount.toLocaleString()} followers`
          ) : (
            `@${creator.username}`
          )}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <Link
            href={profileHref}
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-brand-700 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-brand-400 dark:text-brand-300 dark:hover:bg-brand-950/30"
          >
            View profile
          </Link>
          {messageHref && (
            <ContactLink
              creatorId={creator.id}
              href={messageHref}
              target={creator.whatsapp ? "_blank" : undefined}
              rel={creator.whatsapp ? "noopener noreferrer" : undefined}
              aria-label={`Message ${creator.name}`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-brand-950/30"
            >
              <ChatBubbleOvalLeftIcon aria-hidden className="h-5 w-5" />
            </ContactLink>
          )}
          <ShareMenu placeName={creator.name} contentType="creator" />
        </div>
      </div>
    </article>
  );
}
