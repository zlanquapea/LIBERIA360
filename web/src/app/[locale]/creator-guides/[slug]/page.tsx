import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowRightIcon, CheckBadgeIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { ApiError, getCreatorGuide } from '@/lib/api';
import { absoluteImageUrl, resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { DEFAULT_OG_IMAGE, absoluteUrl } from '@/lib/site';
import { formatCost, formatCreatorCategory } from '@/lib/format';
import { gradientForCategory } from '@/lib/category-colors';
import type { ItineraryStopDetail } from '@/lib/types';
import { SafeImage } from '@/components/SafeImage';
import { GuideActions } from '@/components/creator-guides/GuideActions';
import { GuideVideo } from '@/components/creator-guides/GuideVideo';
import { TripMapLoader } from '@/components/TripMapLoader';
import { tripHasMapPins } from '@/lib/trip-map';
import { HoursStatus } from '@/components/place/HoursStatus';
import { PlaceRating } from '@/components/place-card-parts';

async function load(slug: string) {
  return getCreatorGuide(slug).catch((err) => {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await load(slug).catch(() => null);
  if (!guide) return { title: 'Guide — LIBERIA360' };
  const title = `${guide.title} — a guide by ${guide.creator.name}`;
  const image = (guide.coverImage ? absoluteImageUrl(guide.coverImage) : null) ?? DEFAULT_OG_IMAGE;
  return {
    title,
    description: guide.summary.slice(0, 160),
    openGraph: { type: 'article', title, url: absoluteUrl(`/creator-guides/${guide.slug}`), images: [{ url: image }] },
  };
}

// A published creator guide, laid out like the field journal its card
// promises: the snapshot taped to ruled paper and the creator's byline,
// the whole route as numbered stamps and on a map, then one journal
// entry per stop — photo, the essentials, and the creator's own note in
// their voice — grouped by day.
export default async function CreatorGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await load(slug);
  if (!guide) notFound();
  const t = await getTranslations('creatorGuides');
  const tj = await getTranslations('guideJournal');
  const locale = await getLocale();
  const days = [...new Set(guide.stops.map((s) => s.day))].sort((a, b) => a - b);
  const multiDay = days.length > 1;
  const published = guide.publishedAt
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(guide.publishedAt))
    : null;
  const avatar = guide.creator.profileImage;
  const cover = guide.coverImage ?? guide.stops.find((s) => s.place.images.length > 0)?.place.images[0] ?? null;
  const counties = [...new Set(guide.stops.map((s) => s.place.county.name))];
  const freeCount = guide.stops.filter((s) => s.place.estimatedCostEntry != null && Number(s.place.estimatedCostEntry) === 0).length;
  // Day order first (stable), so numbering runs straight through the days.
  const ordered = [...guide.stops].sort((a, b) => a.day - b.day);
  const mapStops: ItineraryStopDetail[] = ordered.map((s, i) => ({ day: s.day, order: i, notes: s.note, place: s.place }));
  const showMap = tripHasMapPins(mapStops);
  // Numbering runs across the whole guide so the stamps, the map pins and
  // the entries all agree.
  const numbered = ordered.map((stop, i) => ({ stop, n: i + 1 }));

  return (
    <main className="pb-16">
      {/* ── Journal spread ─────────────────────────────────────────── */}
      <header className="lib-paper relative overflow-hidden border-b border-amber-900/10 dark:border-white/10">
        <span aria-hidden className="absolute inset-y-0 start-0 w-3 bg-gradient-to-r from-brand-950 to-brand-800 sm:w-5" />
        <span aria-hidden className="absolute inset-y-3 start-[5px] border-s-2 border-dashed border-gold-300/70 sm:start-[9px]" />
        <div className="mx-auto grid grid-cols-1 max-w-6xl gap-8 px-6 pb-10 pt-8 sm:px-10 sm:pb-14 sm:pt-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <div className="lib-journal__snap relative mx-auto w-full max-w-xl bg-white p-2 pb-8 shadow-xl dark:bg-slate-100 sm:p-3 sm:pb-10">
            <span aria-hidden className="absolute -top-3 start-8 h-6 w-20 rotate-[-6deg] bg-gold-200/85 shadow-sm" />
            <span aria-hidden className="absolute -top-3 end-8 h-6 w-20 rotate-[5deg] bg-gold-200/85 shadow-sm" />
            <div className="relative aspect-[4/3] overflow-hidden bg-brand-900">
              <SafeImage
                src={cover ? resolveImageUrl(cover) : null}
                thumbSrc={cover ? resolveThumbUrl(cover) : null}
                alt=""
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover"
                fallback={<div aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand-700 to-brand-950" />}
              />
            </div>
            <p aria-hidden className="absolute inset-x-0 bottom-2 text-center font-display text-sm italic text-slate-500 sm:bottom-3">
              {counties.join(' · ')}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-sunset-700 dark:text-sunset-300">{t('eyebrow')}</p>
            <h1 className="font-display text-[2rem] font-extrabold leading-[1.05] tracking-tight text-slate-950 [overflow-wrap:anywhere] dark:text-slate-50 sm:text-5xl">
              {guide.title}
            </h1>
            <Link href={`/creators/${guide.creator.username}`} className="flex w-fit items-center gap-3 rounded-full pe-4 transition-colors hover:bg-amber-900/5 dark:hover:bg-white/5">
              <SafeImage
                src={avatar ? resolveImageUrl(avatar) : null}
                thumbSrc={avatar ? resolveThumbUrl(avatar) : null}
                alt=""
                className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow"
                fallback={<span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 font-bold text-white ring-2 ring-white">{guide.creator.name.slice(0, 1)}</span>}
              />
              <span className="text-sm">
                <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-50">
                  {guide.creator.name}
                  {guide.creator.verificationStatus === 'verified' && <CheckBadgeIcon aria-label={t('verifiedCreator')} className="h-4 w-4 text-brand-600" />}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatCreatorCategory(guide.creator.category)}
                  {published && ` · ${t('publishedOn', { date: published })}`}
                </span>
              </span>
            </Link>
            <p className="whitespace-pre-line font-display text-lg italic leading-8 text-slate-700 dark:text-slate-200">“{guide.summary}”</p>

            <ul className="flex flex-wrap gap-2" aria-label={tj('atAGlance')}>
              <li className="lib-stamp">{t('placeCount', { count: guide.stops.length })}</li>
              <li className="lib-stamp">{tj('days', { count: Math.max(1, days.length) })}</li>
              {counties.length > 0 && <li className="lib-stamp">{tj('counties', { count: counties.length })}</li>}
              {freeCount > 0 && <li className="lib-stamp">{tj('free', { count: freeCount })}</li>}
            </ul>

            <GuideActions guideId={guide.id} title={guide.title} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-8 sm:px-6 sm:pt-10 lg:px-10">
        {/* ── The route ─────────────────────────────────────────────── */}
        {guide.stops.length > 0 && (
          <section aria-labelledby="route-title" className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sunset-700 dark:text-sunset-300">{tj('routeEyebrow')}</p>
              <h2 id="route-title" className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
                {t('placesInGuide', { count: guide.stops.length })}
              </h2>
              <ol className="mt-5 flex flex-col">
                {numbered.map(({ stop, n }, i) => {
                  const newDay = multiDay && (i === 0 || numbered[i - 1].stop.day !== stop.day);
                  return (
                    <li key={`${stop.place.id}-${n}`} className="flex flex-col">
                      {newDay && <span className="mb-2 mt-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500 first:mt-0 dark:text-slate-400">{t('day', { day: stop.day })}</span>}
                      <a href={`#stop-${n}`} className="group flex items-center gap-3 py-1.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-sunset-500 bg-white text-sm font-black text-sunset-700 transition-colors group-hover:bg-sunset-500 group-hover:text-white dark:bg-slate-900 dark:text-sunset-300">
                          {n}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900 group-hover:text-brand-800 dark:text-slate-50 dark:group-hover:text-brand-300">{stop.place.name}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{stop.place.category.name} · {stop.place.city.trim()}</span>
                        </span>
                      </a>
                      {i < numbered.length - 1 && <span aria-hidden className="ms-[17px] h-4 border-s-2 border-dotted border-sunset-300 dark:border-sunset-700" />}
                    </li>
                  );
                })}
              </ol>
            </div>
            {showMap && (
              <div className="h-72 overflow-hidden rounded-[2rem] border border-slate-200 shadow-card dark:border-slate-800 lg:sticky lg:top-24 lg:h-96">
                <TripMapLoader stops={mapStops} numbered />
              </div>
            )}
          </section>
        )}

        {guide.videoUrl && (
          <div className="mx-auto w-full max-w-4xl">
            <GuideVideo url={guide.videoUrl} title={guide.title} poster={guide.coverImage} />
          </div>
        )}

        {/* ── Journal entries ───────────────────────────────────────── */}
        <section aria-label={tj('entries')} className="flex flex-col gap-10">
          {days.map((day) => (
            <div key={day} className="flex flex-col gap-6">
              {multiDay && (
                <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold text-slate-950 dark:text-slate-50">
                  <span className="rounded-full bg-brand-900 px-4 py-1 text-sm font-bold uppercase tracking-[0.16em] text-gold-300">{t('day', { day })}</span>
                  <span aria-hidden className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </h2>
              )}
              {numbered
                .filter(({ stop }) => stop.day === day)
                .map(({ stop, n }) => {
                  const place = stop.place;
                  const photo = place.images[0] ?? null;
                  return (
                    <article
                      key={`${place.id}-${n}`}
                      id={`stop-${n}`}
                      className="lib-paper grid scroll-mt-28 overflow-hidden rounded-[1.75rem] shadow-card ring-1 ring-amber-900/10 dark:ring-white/10 md:grid-cols-[minmax(0,22rem)_1fr]"
                    >
                      <Link href={`/places/${place.slug}`} className="group relative block aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-72" tabIndex={-1} aria-hidden>
                        {photo ? (
                          <SafeImage
                            src={resolveImageUrl(photo)}
                            thumbSrc={resolveThumbUrl(photo)}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none"
                            fallback={null}
                          />
                        ) : (
                          <span className="absolute inset-0" style={{ backgroundImage: gradientForCategory(place.category.slug) }} />
                        )}
                        <span className="absolute start-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-sunset-500 font-display text-lg font-black text-white shadow-lg ring-4 ring-white/70">
                          {n}
                        </span>
                      </Link>
                      <div className="flex flex-col gap-3 p-5 sm:p-7">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">{place.category.name}</p>
                        <h3 className="font-display text-2xl font-extrabold leading-tight text-slate-950 dark:text-slate-50">
                          <Link href={`/places/${place.slug}`} className="hover:text-brand-800 dark:hover:text-brand-300">{place.name}</Link>
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1">
                            <MapPinIcon aria-hidden className="h-4 w-4 text-slate-400" />
                            {place.city.trim()}, {place.county.name}
                          </span>
                          <PlaceRating place={place} tone="onLight" />
                          {place.estimatedCostEntry != null && (
                            <span className="font-semibold">{Number(place.estimatedCostEntry) === 0 ? tj('freeEntry') : tj('entry', { price: formatCost(place.estimatedCostEntry) })}</span>
                          )}
                          {place.structuredHours && place.structuredHours.length > 0 && <HoursStatus hours={place.structuredHours} />}
                        </div>
                        {stop.note ? (
                          <blockquote className="relative mt-1 rounded-2xl bg-white/70 p-4 ps-5 shadow-sm ring-1 ring-amber-900/10 dark:bg-slate-900/60 dark:ring-white/10">
                            <span aria-hidden className="absolute -top-3 start-4 font-display text-5xl leading-none text-sunset-400">“</span>
                            <p className="whitespace-pre-line font-display text-lg italic leading-8 text-slate-800 dark:text-slate-100">{stop.note}</p>
                            <footer className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">— {guide.creator.name}</footer>
                          </blockquote>
                        ) : (
                          <p className="line-clamp-3 leading-7 text-slate-600 dark:text-slate-300">{place.description}</p>
                        )}
                        <Link href={`/places/${place.slug}`} className="mt-auto inline-flex w-fit items-center gap-1.5 pt-1 text-sm font-bold text-brand-700 hover:underline dark:text-brand-300">
                          {tj('openPlace')}
                          <ArrowRightIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
            </div>
          ))}
        </section>

        <nav aria-label={tj('more')} className="flex flex-col gap-4 rounded-[2rem] bg-brand-950 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">{tj('endEyebrow')}</p>
            <p className="mt-1 font-display text-2xl font-extrabold">{tj('endTitle')}</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/75">{tj('endBody')}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/creators/${guide.creator.username}`} className="inline-flex min-h-11 items-center rounded-full bg-gold-400 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-gold-300">
              {tj('moreFrom', { name: guide.creator.name.split(' ')[0] })}
            </Link>
            <Link href="/creator-guides" className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
              {tj('allGuides')}
            </Link>
          </div>
        </nav>

        <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {t('attributionNote', { name: guide.creator.name })}
        </p>
      </div>
    </main>
  );
}
