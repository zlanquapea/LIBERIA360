import { notFound } from 'next/navigation';
import {
  CheckBadgeIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MapPinIcon,
  StarIcon,
} from '@heroicons/react/24/solid';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { ApiError, getCreatorByUsername, getCreatorReviews } from '@/lib/api';
import { colorForCreator, gradientForCategory } from '@/lib/category-colors';
import { formatCreatorCategory, formatPriceFrom, formatRating } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { CreatorPortfolioGallery } from '@/components/CreatorPortfolioGallery';
import { ReviewsSection } from '@/components/ReviewsSection';
import { ContactLink } from '@/components/ContactLink';
import { CreatorViewTracker } from '@/components/CreatorViewTracker';
import { BookingRequestSection } from '@/components/BookingRequestSection';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username} — LIBERIA360 Creators` };
}

const SOCIAL_LINKS = [
  { key: 'instagram' as const, label: 'Instagram', prefix: 'https://instagram.com/' },
  { key: 'tiktok' as const, label: 'TikTok', prefix: 'https://tiktok.com/@' },
  { key: 'youtube' as const, label: 'YouTube', prefix: 'https://youtube.com/@' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h2>
      {children}
    </section>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300">
          {item}
        </span>
      ))}
    </div>
  );
}

// Public creator profile (Tech Spec §5 Creator / §3.2) — the "who is this
// creator, what do they offer, what does their work look like" page a
// tourist lands on from a CreatorCard anywhere in the app. Sections with no
// real feature behind them yet (a structured tourism-experiences link to
// specific places/events, a booking flow) are left out entirely rather
// than shown empty or faked — see the [Later phase] tasks tracking each of
// those as separate, deliberately deferred work.
export default async function CreatorProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  const creator = await getCreatorByUsername(username).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!creator) {
    notFound();
  }

  const reviewsResult = await getCreatorReviews(creator.id, { limit: 20 });

  const cover = creator.coverImage ? resolveImageUrl(creator.coverImage) : null;
  const avatar = creator.profileImage ? resolveImageUrl(creator.profileImage) : null;
  const location = creator.county?.name ?? null;
  const hasContactMethod = Boolean(creator.contactEmail || creator.whatsapp || creator.website);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
      <CreatorViewTracker creatorId={creator.id} />
      {/* Header */}
      <div className="flex flex-col">
        <div className="relative h-36 overflow-hidden sm:h-48">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <div aria-hidden className="h-full w-full" style={{ backgroundImage: gradientForCategory(creator.category) }} />
          )}
        </div>

        <div className="flex flex-col gap-3 px-4 pt-3">
          <div className="flex items-end justify-between">
            <span
              className="-mt-14 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white text-3xl font-semibold text-white shadow-md dark:border-slate-950"
              style={{ backgroundColor: colorForCreator(creator.username) }}
            >
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                creator.name.trim().charAt(0).toUpperCase() || '?'
              )}
            </span>
          </div>

          <div>
            <h1 className="flex flex-wrap items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-slate-50">
              {creator.name}
              {creator.verificationStatus === 'verified' && (
                <span
                  aria-label="Verified creator"
                  className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white"
                >
                  <CheckBadgeIcon aria-hidden className="h-3.5 w-3.5" />
                  Verified
                </span>
              )}
              {creator.featured && (
                <span
                  aria-label="Featured creator"
                  className="inline-flex items-center gap-1 rounded-full bg-gold-500 px-2 py-0.5 text-xs font-medium text-white"
                >
                  <StarIcon aria-hidden className="h-3.5 w-3.5" />
                  Featured
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatCreatorCategory(creator.category)}
              {location && (
                <>
                  {' '}
                  · <MapPinIcon aria-hidden className="mb-0.5 inline h-3.5 w-3.5" /> {location}
                </>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-400">
              @{creator.username}
              {creator.followerCount > 0 && ` · ${creator.followerCount.toLocaleString()} followers`}
            </p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{formatRating(creator.rating, creator.reviewCount)}</p>
          </div>

          {creator.bio && <p className="text-slate-700 dark:text-slate-200">{creator.bio}</p>}

          {hasContactMethod && (
            <div className="flex flex-wrap gap-2">
              {creator.contactEmail && (
                <ContactLink
                  creatorId={creator.id}
                  href={`mailto:${creator.contactEmail}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  <EnvelopeIcon aria-hidden className="h-4 w-4" />
                  Email {creator.name.split(' ')[0]}
                </ContactLink>
              )}
              {creator.whatsapp && (
                <ContactLink
                  creatorId={creator.id}
                  href={whatsappLink(creator.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
                >
                  <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                  WhatsApp
                </ContactLink>
              )}
              {creator.website && (
                <ContactLink
                  creatorId={creator.id}
                  href={creator.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
                >
                  <GlobeAltIcon aria-hidden className="h-4 w-4" />
                  Website
                </ContactLink>
              )}
            </div>
          )}

          <BookingRequestSection creator={creator} />

          {(creator.instagram || creator.tiktok || creator.youtube) && (
            <div className="flex flex-wrap gap-2">
              {SOCIAL_LINKS.map(({ key, label, prefix }) => {
                const handle = creator[key];
                if (!handle) return null;
                return (
                  <a
                    key={key}
                    href={`${prefix}${handle.replace(/^@/, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
                  >
                    {label}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4">
        {/* About */}
        {(creator.specialties.length > 0 ||
          creator.languages.length > 0 ||
          creator.certifications.length > 0 ||
          creator.locationsCovered.length > 0 ||
          creator.yearsExperience !== null) && (
          <Section title="About">
            <div className="flex flex-col gap-4">
              {creator.yearsExperience !== null && (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-medium">{creator.yearsExperience}</span>{' '}
                  {creator.yearsExperience === 1 ? 'year' : 'years'} of experience
                </p>
              )}
              {creator.specialties.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Skills &amp; specialties</h3>
                  <TagList items={creator.specialties} />
                </div>
              )}
              {creator.languages.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Languages spoken</h3>
                  <TagList items={creator.languages} />
                </div>
              )}
              {creator.locationsCovered.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Areas served</h3>
                  <TagList items={creator.locationsCovered} />
                </div>
              )}
              {creator.certifications.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">Certifications &amp; credentials</h3>
                  <TagList items={creator.certifications} />
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Services & Experiences */}
        {creator.offerings && creator.offerings.length > 0 && (
          <Section title="Services & Experiences">
            <div className="flex flex-col gap-3">
              {creator.offerings.map((offering) => (
                <div key={offering.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-50">{offering.title}</h3>
                    {offering.priceFrom !== null && (
                      <span className="shrink-0 text-sm font-medium text-brand-700 dark:text-brand-300">{formatPriceFrom(offering.priceFrom)}</span>
                    )}
                  </div>
                  {offering.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{offering.description}</p>}
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {offering.durationLabel && <span>{offering.durationLabel}</span>}
                    {offering.location && <span>{offering.location}</span>}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Portfolio */}
        {creator.portfolioItems && creator.portfolioItems.length > 0 && (
          <Section title="Portfolio">
            <CreatorPortfolioGallery items={creator.portfolioItems} />
          </Section>
        )}

        {/* Availability */}
        {creator.availabilityNote && (
          <Section title="Availability">
            <p className="text-sm text-slate-700 dark:text-slate-200">{creator.availabilityNote}</p>
          </Section>
        )}

        {creator.contentLinks.length > 0 && (
          <Section title="Featured content">
            <ul className="flex flex-col gap-1.5">
              {creator.contentLinks.map((link) => (
                <li key={link}>
                  <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-brand-700 dark:text-brand-300 hover:underline">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Reviews */}
        <Section title="Reviews">
          <ReviewsSection creatorId={creator.id} initialReviews={reviewsResult.data} />
        </Section>
      </div>
    </main>
  );
}
