import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  MapPinIcon,
  PaperAirplaneIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import { ApiError, getBusinessBySlug, getBusinessContent, getMenuItems, getReviews } from '@/lib/api';
import { colorForCategory } from '@/lib/category-colors';
import { formatBusinessContentType, formatBusinessType, formatCost, formatRating } from '@/lib/format';
import { resolveImageUrl } from '@/lib/images';
import { directionsLink, whatsappLink } from '@/lib/contact';
import { VerificationBadge } from '@/components/VerificationBadge';
import { VerificationTrustInfo } from '@/components/VerificationTrustInfo';
import { PlaceGallery } from '@/components/PlaceGallery';
import { PlaceMiniMapLoader } from '@/components/PlaceMiniMapLoader';
import { SafeImage } from '@/components/SafeImage';
import { ReviewsSection } from '@/components/ReviewsSection';
import { ReportButton } from '@/components/ReportButton';
import { ShareMenu } from '@/components/ShareMenu';
import { SaveButton } from '@/components/SaveButton';
import { BookingRequestSection } from '@/components/BookingRequestSection';
import { MenuSection } from '@/components/MenuSection';
import { JsonLd } from '@/components/JsonLd';
import { businessJsonLd } from '@/lib/structured-data';
import type { BusinessContent } from '@/lib/types';

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

function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{eyebrow}</p>}
      <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{title}</h2>
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
    <article className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
      {cover && (
        <SafeImage
          src={cover}
          alt=""
          className="h-40 w-full rounded-xl object-cover"
          fallback={<div aria-hidden className="h-40 w-full rounded-xl bg-slate-200 dark:bg-slate-700" />}
        />
      )}
      <span className="w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
        {formatBusinessContentType(item.type)}
      </span>
      <h3 className="font-semibold text-slate-950 dark:text-slate-50">{item.title}</h3>
      <p className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{item.body}</p>
      {validity && <p className="text-xs text-slate-500 dark:text-slate-400">{validity}</p>}
      {item.externalLink && (
        <a
          href={item.externalLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
        >
          Learn more
        </a>
      )}
    </article>
  );
}

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
  // Only restaurants (and other food-and-dining types) get a Menu section
  // on the public profile — see MenuItemsManager's gate in
  // BusinessClaimSection for the owner-side counterpart. Skipping the
  // fetch entirely for every other business type avoids a pointless
  // network round-trip that would always come back empty.
  const menuItems = business.type === 'restaurant' ? await getMenuItems(business.id) : [];
  const linkedPlace = business.linkedPlace;
  const gallery = (business.images.length > 0 ? business.images : linkedPlace.images).map(resolveImageUrl);
  const location = `${linkedPlace.city}, ${linkedPlace.county.name} County`;
  const hasPriceRange = business.priceRangeMin != null || business.priceRangeMax != null;
  const priceRange = hasPriceRange
    ? `${formatCost(business.priceRangeMin)}${business.priceRangeMax != null ? ` – ${formatCost(business.priceRangeMax)}` : ''}`
    : null;

  const actionClass =
    'inline-flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2';
  const mutedActionClass =
    `${actionClass} border border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30`;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 bg-slate-50/70 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:px-10 lg:py-10 dark:bg-slate-950/20">
      <JsonLd data={businessJsonLd(business)} />

      <PlaceGallery
        images={gallery}
        categorySlug={linkedPlace.category.slug}
        categoryIcon={linkedPlace.category.icon}
        alt={business.name}
      />

      <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{formatBusinessType(business.type)}</p>
            <h1 className="flex min-w-0 flex-wrap items-center gap-2 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 sm:text-5xl">
              <span>{business.name}</span>
              <VerificationBadge status={business.verificationStatus} />
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ShareMenu placeName={business.name} />
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
          <MapPinIcon aria-hidden className="h-4 w-4 text-sky-500" />
          {location}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <span className="font-semibold text-slate-950 dark:text-slate-50">{formatRating(linkedPlace.rating, linkedPlace.reviewCount)}</span>
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span>{formatBusinessType(business.type)}</span>
        </div>

        {linkedPlace.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {linkedPlace.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      <section className="flex flex-col gap-5 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">Plan your visit</p>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-slate-50">Helpful actions</h2>
          </div>
          <MapPinIcon aria-hidden className="h-7 w-7 text-sky-500" />
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <a
            href={directionsLink(linkedPlace.latitude, linkedPlace.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${actionClass} bg-brand-700 text-white hover:bg-brand-800`}
          >
            <PaperAirplaneIcon aria-hidden className="h-5 w-5 -rotate-45" />
            Directions
          </a>
          {business.phone ? (
            <a href={`tel:${business.phone}`} className={`${actionClass} bg-red-500 text-white hover:bg-red-600`}>
              <PhoneIcon aria-hidden className="h-5 w-5" />
              Call
            </a>
          ) : (
            <span className={mutedActionClass} title="No phone number is listed yet.">
              <PhoneIcon aria-hidden className="h-5 w-5 text-slate-400" />
              Call
            </span>
          )}
          {business.whatsapp ? (
            <a
              href={whatsappLink(business.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${actionClass} bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5" />
              WhatsApp
            </a>
          ) : (
            <span className={mutedActionClass} title="No WhatsApp number is listed yet.">
              <ChatBubbleLeftRightIcon aria-hidden className="h-5 w-5 text-slate-400" />
              WhatsApp
            </span>
          )}
          <div className="min-w-0">
            <BookingRequestSection
              business={business}
              mode="link"
              href={`/businesses/${business.slug}/book`}
            />
          </div>
          <ShareMenu placeName={business.name} variant="action" />
          <SaveButton
            slug={linkedPlace.slug}
            placeId={linkedPlace.id}
            className="min-h-16 w-full justify-center rounded-2xl border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-brand-950/30"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {business.email && (
            <a href={`mailto:${business.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30">
              <EnvelopeIcon aria-hidden className="h-4 w-4" />
              Email
            </a>
          )}
          {business.website && (
            <a href={business.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-brand-300 dark:hover:bg-brand-950/30">
              <GlobeAltIcon aria-hidden className="h-4 w-4" />
              Visit website
            </a>
          )}
        </div>

        <div className="grid gap-4 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-950 dark:text-slate-50">Listing information</span>
              <VerificationBadge status={business.verificationStatus} />
            </div>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {business.openingHours && (
                <div className="flex items-start gap-2">
                  <ClockIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Hours</dt>
                    <dd className="mt-0.5 text-slate-700 dark:text-slate-200">{business.openingHours}</dd>
                  </div>
                </div>
              )}
              {priceRange && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Price guide</dt>
                  <dd className="mt-0.5 text-slate-700 dark:text-slate-200">{priceRange}</dd>
                </div>
              )}
            </dl>
          </div>
          {business.servicesOffered.length > 0 && (
            <div className="sm:max-w-xs">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Services listed</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {business.servicesOffered.map((service) => (
                  <span key={service} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {service}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <VerificationTrustInfo status={business.verificationStatus} verifiedAt={business.verifiedAt} />

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span>See something that needs correcting?</span>
          <ReportButton targetType="business" targetId={business.id} label="Report an update" />
        </div>
      </section>

      <Section eyebrow="Discover the business" title="About this business">
        <p className="max-w-3xl leading-8 text-slate-700 dark:text-slate-200">{business.description || linkedPlace.description}</p>
      </Section>

      <MenuSection items={menuItems} />

      <Section eyebrow="Find your way" title="Location">
        <div className="h-56 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 sm:h-72">
          <PlaceMiniMapLoader
            latitude={linkedPlace.latitude}
            longitude={linkedPlace.longitude}
            color={colorForCategory(linkedPlace.category.slug)}
            icon={linkedPlace.category.icon}
            categorySlug={linkedPlace.category.slug}
          />
        </div>
      </Section>

      {(gallery.length > 0 || business.videos.length > 0) && (
        <Section eyebrow="See more" title="Gallery & videos">
          {business.videos.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {business.videos.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {contentResult.data.length > 0 && (
        <Section eyebrow="From the business" title="Updates">
          <div className="grid gap-3 sm:grid-cols-2">
            {contentResult.data.map((item) => (
              <UpdateCard key={item.id} item={item} />
            ))}
          </div>
        </Section>
      )}

      <Section eyebrow="Visitor notes" title="Reviews">
        <ReviewsSection placeId={business.linkedPlaceId} initialReviews={reviewsResult.data} />
      </Section>
    </main>
  );
}
