import { notFound } from 'next/navigation';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MapPinIcon,
  PhoneIcon,
} from '@heroicons/react/24/solid';
import { BuildingStorefrontIcon } from '@heroicons/react/24/outline';
import { ApiError, getBusinessBySlug, getBusinessContent, getReviews } from '@/lib/api';
import { gradientForCategory } from '@/lib/category-colors';
import { formatBusinessContentType, formatBusinessType, formatCost } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { whatsappLink } from '@/lib/contact';
import { VerificationBadge } from '@/components/VerificationBadge';
import { SafeImage } from '@/components/SafeImage';
import { ReviewsSection } from '@/components/ReviewsSection';
import { ReportButton } from '@/components/ReportButton';
import { JsonLd } from '@/components/JsonLd';
import { businessJsonLd } from '@/lib/structured-data';
import type { BusinessContent } from '@/lib/types';

// SEO (product review readout, Aug 25, 2026): "each business ... should
// eventually have its own properly structured page." The previous
// metadata never actually fetched the business, so every listing shared
// the same generic title — this uses the real name/description instead.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const business = await getBusinessBySlug(slug).catch(() => null);
  if (!business) {
    return { title: 'Business — LIBERIA360' };
  }
  const description = business.description
    ? business.description.length > 160
      ? `${business.description.slice(0, 157)}…`
      : business.description
    : undefined;
  return {
    title: `${business.name} — LIBERIA360`,
    description,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-6">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{title}</h2>
      {children}
    </section>
  );
}

function formatValidityWindow(validFrom: string | null, validUntil: string | null): string | null {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (validFrom && validUntil) {
    return `${new Date(validFrom).toLocaleDateString('en-US', opts)} – ${new Date(validUntil).toLocaleDateString('en-US', opts)}`;
  }
  if (validUntil) return `Through ${new Date(validUntil).toLocaleDateString('en-US', opts)}`;
  if (validFrom) return `From ${new Date(validFrom).toLocaleDateString('en-US', opts)}`;
  return null;
}

function UpdateCard({ item }: { item: BusinessContent }) {
  const validity = formatValidityWindow(item.validFrom, item.validUntil);
  const cover = item.images[0] ? resolveImageUrl(item.images[0]) : null;

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      {cover && (
        <SafeImage
          src={cover}
          alt=""
          className="h-40 w-full rounded-lg object-cover"
          fallback={<div aria-hidden className="h-40 w-full rounded-lg bg-slate-200 dark:bg-slate-700" />}
        />
      )}
      <span className="w-fit rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
        {formatBusinessContentType(item.type)}
      </span>
      <h3 className="font-semibold text-slate-900 dark:text-slate-50">{item.title}</h3>
      <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{item.body}</p>
      {validity && <p className="text-xs text-slate-500 dark:text-slate-400">{validity}</p>}
      {item.externalLink && (
        <a
          href={item.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
        >
          Learn more
        </a>
      )}
    </article>
  );
}

// Public business profile — the "who is this business, what do they
// offer, what does the place look like" page a traveler lands on from a
// BusinessCard anywhere in the app. Mirrors the Creator public profile's
// structure.
export default async function BusinessProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const business = await getBusinessBySlug(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!business) {
    notFound();
  }

  const reviewsResult = await getReviews(business.linkedPlaceId, { limit: 20 });
  const contentResult = await getBusinessContent(business.id, { limit: 20 });

  const cover = business.logoImage
    ? resolveImageUrl(business.logoImage)
    : business.images[0]
      ? resolveImageUrl(business.images[0])
      : null;
  const gallery = business.images.map(resolveImageUrl);
  const location = `${business.linkedPlace.city}, ${business.linkedPlace.county.name}`;
  const hasContactMethod = Boolean(business.phone || business.whatsapp || business.email || business.website);
  // Loose comparison — see formatCost's doc comment for why a field the
  // backend omitted comes through as `undefined`, not `null`.
  const hasPriceRange = business.priceRangeMin != null || business.priceRangeMax != null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
      <JsonLd data={businessJsonLd(business)} />
      {/* Header */}
      <div className="flex flex-col">
        <div className="relative h-36 overflow-hidden sm:h-48">
          <SafeImage
            src={cover}
            alt=""
            loading="eager"
            className="h-full w-full object-cover"
            fallback={
              <div
                aria-hidden
                className="flex h-full w-full items-center justify-center"
                style={{ backgroundImage: gradientForCategory(business.type) }}
              >
                <BuildingStorefrontIcon className="h-14 w-14 text-white/90" />
              </div>
            }
          />
        </div>

        <div className="flex flex-col gap-3 px-4 pt-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-1.5 text-xl font-bold text-slate-900 dark:text-slate-50">
              {business.name}
              <VerificationBadge status={business.verificationStatus} />
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatBusinessType(business.type)}
              {' · '}
              <MapPinIcon aria-hidden className="mb-0.5 inline h-3.5 w-3.5" /> {location}
            </p>
          </div>

          {business.description && <p className="text-slate-700 dark:text-slate-200">{business.description}</p>}

          {hasContactMethod && (
            <div className="flex flex-wrap gap-2">
              {business.phone && (
                <a
                  href={`tel:${business.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  <PhoneIcon aria-hidden className="h-4 w-4" />
                  Call
                </a>
              )}
              {business.whatsapp && (
                <a
                  href={whatsappLink(business.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <ChatBubbleLeftRightIcon aria-hidden className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
              {business.email && (
                <a
                  href={`mailto:${business.email}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
                >
                  <EnvelopeIcon aria-hidden className="h-4 w-4" />
                  Email
                </a>
              )}
              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-brand-500"
                >
                  <GlobeAltIcon aria-hidden className="h-4 w-4" />
                  Website
                </a>
              )}
            </div>
          )}

          <ReportButton targetType="business" targetId={business.id} />
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4">
        {/* Overview */}
        {(business.openingHours || hasPriceRange) && (
          <Section title="Overview">
            <div className="flex flex-col gap-2 text-sm text-slate-700 dark:text-slate-200">
              {business.openingHours && (
                <p className="flex items-start gap-1.5">
                  <ClockIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-400" />
                  {business.openingHours}
                </p>
              )}
              {hasPriceRange && (
                <p>
                  Price range: {formatCost(business.priceRangeMin)}
                  {business.priceRangeMax != null && ` – ${formatCost(business.priceRangeMax)}`}
                </p>
              )}
            </div>
          </Section>
        )}

        {/* Services & Experiences */}
        {business.servicesOffered.length > 0 && (
          <Section title="Services & Experiences">
            <div className="flex flex-wrap gap-1.5">
              {business.servicesOffered.map((service) => (
                <span
                  key={service}
                  className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-300"
                >
                  {service}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Gallery */}
        {(gallery.length > 0 || business.videos.length > 0) && (
          <Section title="Gallery">
            {gallery.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {gallery.map((img) => (
                  <SafeImage
                    key={img}
                    src={img}
                    thumbSrc={resolveThumbUrl(img)}
                    alt={`${business.name} photo`}
                    className="aspect-square w-full rounded-lg object-cover"
                    fallback={<div aria-hidden className="aspect-square w-full rounded-lg bg-slate-200 dark:bg-slate-700" />}
                  />
                ))}
              </div>
            )}
            {business.videos.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {business.videos.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-brand-700 dark:text-brand-300 hover:underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Updates — business-authored offers, announcements, articles,
            travel tips & experiences. Approved-only (getBusinessContent's
            gate), so a DRAFT/SUBMITTED/REJECTED item the owner is still
            working on never shows here — same posture as the Business
            listing itself only appearing once APPROVED. */}
        {contentResult.data.length > 0 && (
          <Section title="Updates">
            <div className="flex flex-col gap-3">
              {contentResult.data.map((item) => (
                <UpdateCard key={item.id} item={item} />
              ))}
            </div>
          </Section>
        )}

        {/* Reviews — reuses the linked Place's reviews; a business is the
            same physical destination as its Place, not a separate
            review-bearing entity. */}
        <Section title="Reviews">
          <ReviewsSection placeId={business.linkedPlaceId} initialReviews={reviewsResult.data} />
        </Section>
      </div>
    </main>
  );
}
