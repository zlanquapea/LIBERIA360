import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MapPinIcon,
  StarIcon,
} from '@heroicons/react/24/solid';
import { ApiError, getCreatorByUsername, getCreatorFeedForCreator, getCreatorReviews } from '@/lib/api';
import { colorForCreator, gradientForCategory } from '@/lib/category-colors';
import { formatCreatorCategory, formatPriceFrom, formatRating } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { CreatorPortfolioGallery } from '@/components/CreatorPortfolioGallery';
import { CreatorFeed } from '@/components/CreatorFeed';
import { ReviewsSection } from '@/components/ReviewsSection';
import { ContactLink } from '@/components/ContactLink';
import { CreatorViewTracker } from '@/components/CreatorViewTracker';
import { BookingRequestSection } from '@/components/BookingRequestSection';
import { ShareMenu } from '@/components/ShareMenu';
import { CreatorFollowButton } from '@/components/CreatorFollowButton';
import { SafeImage } from '@/components/SafeImage';
import { JsonLd } from '@/components/JsonLd';
import { creatorJsonLd } from '@/lib/structured-data';

// SEO (product review readout, Aug 25, 2026): each creator should have its
// own structured page. The profile is now also the social-style destination
// for real portfolio media, offerings, contact actions, and booking requests.
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const creator = await getCreatorByUsername(username).catch(() => null);
  if (!creator) {
    return { title: 'Creator — LIBERIA360' };
  }
  const description = creator.bio
    ? creator.bio.length > 160
      ? `${creator.bio.slice(0, 157)}…`
      : creator.bio
    : undefined;
  return {
    title: `${creator.name} (@${creator.username}) — LIBERIA360`,
    description,
  };
}

const SOCIAL_LINKS = [
  { key: 'instagram' as const, label: 'Instagram', prefix: 'https://instagram.com/' },
  { key: 'tiktok' as const, label: 'TikTok', prefix: 'https://tiktok.com/@' },
  { key: 'youtube' as const, label: 'YouTube', prefix: 'https://youtube.com/@' },
];

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {item}
        </span>
      ))}
    </div>
  );
}

function ProfileSection({ id, eyebrow, title, children }: { id: string; eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{eyebrow}</p>}
      <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ContactAction({ creator, hasContactMethod }: { creator: Awaited<ReturnType<typeof getCreatorByUsername>>; hasContactMethod: boolean }) {
  if (!hasContactMethod) return null;
  if (creator.whatsapp) {
    return (
      <ContactLink
        creatorId={creator.id}
        href={whatsappLink(creator.whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30"
      >
        <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5 text-emerald-600" />
        Message
      </ContactLink>
    );
  }
  if (creator.contactEmail) {
    return (
      <ContactLink
        creatorId={creator.id}
        href={`mailto:${creator.contactEmail}`}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30"
      >
        <EnvelopeIcon aria-hidden className="h-5 w-5 text-brand-600" />
        Message
      </ContactLink>
    );
  }
  return (
    <ContactLink
      creatorId={creator.id}
      href={creator.website!}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30"
    >
      <GlobeAltIcon aria-hidden className="h-5 w-5 text-sky-500" />
      Website
    </ContactLink>
  );
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const creator = await getCreatorByUsername(username).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!creator) {
    notFound();
  }

  const [reviewsResult, creatorFeedResult] = await Promise.all([
    getCreatorReviews(creator.id, { limit: 20 }),
    getCreatorFeedForCreator(creator.username, { limit: 20 }),
  ]);
  const cover = creator.coverImage ? resolveImageUrl(creator.coverImage) : null;
  const coverThumb = creator.coverImage ? resolveThumbUrl(creator.coverImage) : null;
  const avatar = creator.profileImage ? resolveImageUrl(creator.profileImage) : null;
  const avatarThumb = creator.profileImage ? resolveThumbUrl(creator.profileImage) : null;
  const location = creator.county?.name ?? creator.locationsCovered[0] ?? null;
  const hasContactMethod = Boolean(creator.contactEmail || creator.whatsapp || creator.website);
  const hasWork = Boolean(creatorFeedResult.data.length > 0 || (creator.portfolioItems && creator.portfolioItems.length > 0) || creator.contentLinks.length > 0);
  const hasAbout = Boolean(
    creator.bio ||
      creator.specialties.length > 0 ||
      creator.languages.length > 0 ||
      creator.certifications.length > 0 ||
      creator.locationsCovered.length > 0 ||
      creator.yearsExperience !== null,
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-5 bg-slate-50/60 px-4 pb-12 sm:px-6 lg:px-8 dark:bg-slate-950/20">
      <JsonLd data={creatorJsonLd(creator)} />
      <CreatorViewTracker creatorId={creator.id} />

      <section className="overflow-hidden rounded-b-[2rem] border-x border-b border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="relative h-48 overflow-hidden sm:h-64">
          <SafeImage
            src={cover}
            thumbSrc={coverThumb}
            alt=""
            className="h-48 w-full object-cover sm:h-64"
            fallback={<div aria-hidden className="h-48 w-full sm:h-64" style={{ backgroundImage: gradientForCategory(creator.category) }} />}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {creator.featured && (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-gold-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
              <StarIcon aria-hidden className="h-3.5 w-3.5" />
              Featured creator
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4 p-4 pt-0 sm:p-7 sm:pt-0">
          <div className="-mt-12 flex items-end justify-between gap-3 sm:-mt-16">
            <span
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white text-3xl font-semibold text-white shadow-lg dark:border-slate-900 sm:h-32 sm:w-32"
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
            <div className="flex items-center gap-2 pb-1">
              <ShareMenu placeName={creator.name} contentType="creator" />
            </div>
          </div>

          <div>
            <h1 className="flex flex-wrap items-center gap-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-4xl">
              <span>{creator.name}</span>
              {creator.verificationStatus === 'verified' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
                  <CheckBadgeIcon aria-hidden className="h-4 w-4" />
                  Verified
                </span>
              )}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <span>{formatCreatorCategory(creator.category)}</span>
              {location && (
                <>
                  <span aria-hidden>·</span>
                  <MapPinIcon aria-hidden className="h-4 w-4 text-sky-500" />
                  <span>{location}</span>
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              @{creator.username}
              {creator.followerCount > 0 && ` · ${creator.followerCount.toLocaleString()} followers`}
            </p>
          </div>

          {creator.bio && <p className="max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-200">{creator.bio}</p>}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div id="booking" className="col-span-2 sm:col-span-1">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Request to book</p>
              <BookingRequestSection creator={creator} />
            </div>
            <CreatorFollowButton creatorId={creator.id} initialFollowerCount={creator.followerCount} />
            <ContactAction creator={creator} hasContactMethod={hasContactMethod} />
            <ShareMenu placeName={creator.name} contentType="creator" variant="action" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Booking sends a request to the creator. No payment is taken now.</p>

          {(creator.instagram || creator.tiktok || creator.youtube) && (
            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
              {SOCIAL_LINKS.map(({ key, label, prefix }) => {
                const handle = creator[key];
                if (!handle) return null;
                return (
                  <a
                    key={key}
                    href={`${prefix}${handle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <nav aria-label="Creator profile sections" className="sticky top-0 z-20 grid grid-cols-4 rounded-2xl border border-slate-200 bg-white/95 p-1 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        {[
          ['Work', hasWork ? 'creator-work' : 'creator-about'],
          ['Services', 'creator-services'],
          ['About', 'creator-about'],
          ['Reviews', 'creator-reviews'],
        ].map(([label, id]) => (
          <a key={label} href={`#${id}`} className="rounded-xl px-2 py-2.5 text-sm font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-950/30 dark:hover:text-brand-300">
            {label}
          </a>
        ))}
      </nav>

      {hasWork && (
        <ProfileSection id="creator-work" eyebrow="Creator feed" title="Latest work">
          {creatorFeedResult.data.length > 0 ? (
            <CreatorFeed initialPosts={creatorFeedResult.data} showHeader={false} />
          ) : creator.portfolioItems && creator.portfolioItems.length > 0 ? (
            <CreatorPortfolioGallery items={creator.portfolioItems} />
          ) : (
            <ul className="flex flex-col gap-2">
              {creator.contentLinks.map((link) => (
                <li key={link}>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-brand-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-800 dark:text-brand-300 dark:hover:bg-brand-950/30">
                    <span className="break-all">{link}</span>
                    <span aria-hidden>↗</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </ProfileSection>
      )}

      {creator.offerings && creator.offerings.length > 0 && (
        <ProfileSection id="creator-services" eyebrow="Book an experience" title="Services & experiences">
          <div className="flex flex-col gap-3">
            {creator.offerings.map((offering) => (
              <article key={offering.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">{offering.title}</h3>
                  {offering.priceFrom !== null && <span className="shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-300">{formatPriceFrom(offering.priceFrom)}</span>}
                </div>
                {offering.description && <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{offering.description}</p>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {offering.durationLabel && <span>{offering.durationLabel}</span>}
                    {offering.location && <span>{offering.location}</span>}
                  </p>
                  <a href="#booking" className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400">
                    <CalendarDaysIcon aria-hidden className="h-4 w-4" />
                    Request to book
                  </a>
                </div>
              </article>
            ))}
          </div>
        </ProfileSection>
      )}

      {hasAbout && (
        <ProfileSection id="creator-about" eyebrow="Get to know the creator" title="About">
          <div className="flex flex-col gap-4">
            {creator.yearsExperience !== null && (
              <p className="text-sm text-slate-700 dark:text-slate-200">
                <span className="font-semibold">{creator.yearsExperience}</span> {creator.yearsExperience === 1 ? 'year' : 'years'} of experience
              </p>
            )}
            {creator.specialties.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Skills &amp; specialties</h3>
                <div className="mt-2"><TagList items={creator.specialties} /></div>
              </div>
            )}
            {creator.languages.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Languages spoken</h3>
                <div className="mt-2"><TagList items={creator.languages} /></div>
              </div>
            )}
            {creator.locationsCovered.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Areas served</h3>
                <div className="mt-2"><TagList items={creator.locationsCovered} /></div>
              </div>
            )}
            {creator.certifications.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Certifications &amp; credentials</h3>
                <div className="mt-2"><TagList items={creator.certifications} /></div>
              </div>
            )}
          </div>
        </ProfileSection>
      )}

      {creator.availabilityNote && (
        <ProfileSection id="creator-availability" eyebrow="Plan ahead" title="Availability">
          <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{creator.availabilityNote}</p>
        </ProfileSection>
      )}

      <ProfileSection id="creator-reviews" eyebrow="Community notes" title="Reviews">
        <ReviewsSection creatorId={creator.id} initialReviews={reviewsResult.data} />
      </ProfileSection>
    </main>
  );
}
