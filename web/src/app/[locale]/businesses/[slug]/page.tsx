import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRightIcon, EnvelopeIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { ApiError, getBusinessBySlug, getBusinessContent, getMenuItems, getMenuSettings, getReviews } from '@/lib/api';
import { colorForCategory } from '@/lib/category-colors';
import { formatBusinessContentType } from '@/lib/format';
import { absoluteImageUrl, galleryImages, resolveImageUrl } from '@/lib/images';
import { DEFAULT_OG_IMAGE, absoluteUrl } from '@/lib/site';
import { directionsLink } from '@/lib/contact';
import { KIND_CAPS, placeKind } from '@/lib/place-kind';
import { PlaceGallery } from '@/components/PlaceGallery';
import { PlaceMiniMapLoader } from '@/components/PlaceMiniMapLoader';
import { PlaceKeyFacts } from '@/components/PlaceKeyFacts';
import { SafeImage } from '@/components/SafeImage';
import { ReviewsSection } from '@/components/ReviewsSection';
import { MenuPreviewSection } from '@/components/MenuPreviewSection';
import { PlaceIdentity } from '@/components/place/PlaceIdentity';
import { PlaceAtAGlance } from '@/components/place/PlaceAtAGlance';
import { EssentialHeader } from '@/components/place/EssentialHeader';
import { EssentialDetails } from '@/components/place/EssentialDetails';
import { VisitorPhotos } from '@/components/place/VisitorPhotos';
import { businessHasMenu } from '@/lib/menu';
import { JsonLd } from '@/components/JsonLd';
import { businessJsonLd } from '@/lib/structured-data';
import type { BusinessContent, Place } from '@/lib/types';

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
  const title = `${business.name} — LIBERIA360`;
  const url = absoluteUrl(`/businesses/${business.slug}`);
  const coverPath = business.images[0] ?? business.linkedPlace.images[0];
  const image = (coverPath ? absoluteImageUrl(coverPath) : null) ?? DEFAULT_OG_IMAGE;
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

function SectionCard({ id, eyebrow, title, action, children }: { id?: string; eyebrow?: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">{eyebrow}</p>}
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-950 dark:text-slate-50">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function validityDates(item: BusinessContent, locale: string): { from: string | null; until: string | null } {
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  return {
    from: item.validFrom ? fmt.format(new Date(item.validFrom)) : null,
    until: item.validUntil ? fmt.format(new Date(item.validUntil)) : null,
  };
}

// A business profile, shaped by the same "what kind of place is this?"
// rules as a place page (see lib/place-kind): a clinic, bank or transport
// operator opens on the call-first essentials header with no booking or
// trip prompts; a hotel, restaurant or shop opens on its photos and an
// at-a-glance strip. On top of that come what only a claimed business
// has — its menu, its own offers and announcements, email and videos.
export default async function BusinessProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const business = await getBusinessBySlug(slug).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!business) {
    notFound();
  }

  const [t, tk, tp, locale] = await Promise.all([
    getTranslations('businessPage'),
    getTranslations('placeKind'),
    getTranslations('placeDetail'),
    getLocale(),
  ]);
  const [reviewsResult, contentResult] = await Promise.all([
    getReviews(business.linkedPlaceId, { limit: 20 }),
    getBusinessContent(business.id, { limit: 20 }),
  ]);
  // Only food-and-drink businesses have a menu; skip the fetch for the rest.
  const [menuItems, menuSettings] = businessHasMenu(business.type)
    ? await Promise.all([getMenuItems(business.id), getMenuSettings(business.id)])
    : [[], null];

  const linked = business.linkedPlace;
  // The business's own name, story and photos lead; the linked place
  // supplies location, hours and practical details.
  const place: Place = {
    ...linked,
    name: business.name,
    description: business.description || linked.description,
  };
  const kind = placeKind(linked, business);
  const caps = KIND_CAPS[kind];
  const essential = kind === 'health' || kind === 'service';
  const verification = business.verificationStatus;
  const gallery = galleryImages(linked.images, business.images);
  const updates = contentResult.data;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:gap-7 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <JsonLd data={businessJsonLd(business)} />

      {essential ? (
        <>
          <EssentialHeader place={place} kind={kind} business={business} verificationStatus={verification} />
          <EssentialDetails place={place} business={business} />
        </>
      ) : (
        <>
          <div>
            <PlaceGallery images={gallery} categorySlug={linked.category.slug} categoryIcon={linked.category.icon} alt={business.name} overlapped />
            <PlaceIdentity place={place} kind={kind} verificationStatus={verification} hoursText={business.openingHours ?? linked.openingHours} />
          </div>
          <PlaceAtAGlance place={place} kind={kind} business={business} menuCount={menuItems.length} menuSettings={menuSettings} />
        </>
      )}

      {!essential && (
        <MenuPreviewSection items={menuItems} menuHref={`/businesses/${business.slug}/menu`} currency={menuSettings?.currency} settings={menuSettings} />
      )}

      <PlaceKeyFacts place={place} business={business} kind={kind} />

      {/* Offers and announcements are time-sensitive — they sit high. */}
      {updates.length > 0 && (
        <SectionCard eyebrow={t('updatesEyebrow')} title={t('updatesTitle')}>
          <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-1 sm:-mx-7 sm:px-7">
            {updates.map((item) => {
              const cover = item.images[0] ? resolveImageUrl(item.images[0]) : null;
              const { from, until } = validityDates(item, locale);
              const validity =
                from && until ? `${from} – ${until}` : until ? t('through', { date: until }) : from ? t('from', { date: from }) : null;
              return (
                <article key={item.id} className="flex w-72 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 sm:w-80">
                  <div className="relative aspect-[16/9] overflow-hidden" style={cover ? undefined : { backgroundColor: colorForCategory(linked.category.slug) }}>
                    {cover && <SafeImage src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" fallback={null} />}
                    <span className="absolute start-3 top-3 rounded-full bg-sunset-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                      {formatBusinessContentType(item.type)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="font-display text-lg font-bold leading-snug text-slate-950 dark:text-slate-50">{item.title}</h3>
                    <p className="line-clamp-4 whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-200">{item.body}</p>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      {validity ? <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{validity}</p> : <span />}
                      {item.externalLink && (
                        <a href={item.externalLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                          {t('learnMore')}
                          <ArrowRightIcon aria-hidden className="h-3.5 w-3.5 rtl:-scale-x-100" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard id="about" eyebrow={t('aboutEyebrow')} title={t('aboutTitle', { name: business.name })}>
        <p className="max-w-3xl whitespace-pre-line leading-8 text-slate-700 dark:text-slate-200">{place.description}</p>
        {!essential && business.servicesOffered.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('services')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {business.servicesOffered.map((service) => (
                <li key={service} className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800 dark:bg-brand-950/40 dark:text-brand-200">{service}</li>
              ))}
            </ul>
          </div>
        )}
        {business.email && (
          <a href={`mailto:${business.email}`} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-brand-950/30">
            <EnvelopeIcon aria-hidden className="h-4 w-4" />
            {t('email')}
          </a>
        )}
      </SectionCard>

      <SectionCard
        eyebrow={tp('findYourWay')}
        title={tp('location')}
        action={
          <a href={directionsLink(linked.latitude, linked.longitude)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
            {tk('directions')}
            <ArrowRightIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
          </a>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{linked.city.trim()}, {linked.county.name} County</p>
        <div className="h-56 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 sm:h-72">
          <PlaceMiniMapLoader latitude={linked.latitude} longitude={linked.longitude} color={colorForCategory(linked.category.slug)} icon={linked.category.icon} categorySlug={linked.category.slug} />
        </div>
        {linked.transportNotes && <p className="whitespace-pre-line text-sm leading-6 text-slate-700 dark:text-slate-300">{linked.transportNotes}</p>}
      </SectionCard>

      {essential && gallery.length > 1 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-slate-950 dark:text-slate-50">{tk('photos')}</h2>
          <PlaceGallery images={gallery} categorySlug={linked.category.slug} categoryIcon={linked.category.icon} alt={business.name} />
        </section>
      )}

      {business.videos.length > 0 && (
        <SectionCard eyebrow={t('videosEyebrow')} title={t('videosTitle')}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {business.videos.map((url, i) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 transition-colors hover:border-brand-400 hover:bg-brand-50 dark:border-slate-800 dark:hover:bg-brand-950/30">
                  <PlayCircleIcon aria-hidden className="h-8 w-8 shrink-0 text-sunset-600" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900 dark:text-slate-50">{t('video', { n: i + 1 })}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{url}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {!essential && caps.stories && <VisitorPhotos reviews={reviewsResult.data} />}

      <SectionCard eyebrow={essential ? tk('experiencesEyebrow') : tp('visitorNotes')} title={tp('reviews')}>
        <ReviewsSection placeId={business.linkedPlaceId} initialReviews={reviewsResult.data} />
      </SectionCard>
    </main>
  );
}
