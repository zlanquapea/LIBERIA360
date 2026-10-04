import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { BuildingLibraryIcon, MapPinIcon } from '@heroicons/react/24/solid';
import { CountyIcon } from '@/lib/icons';
import { colorForCounty } from '@/lib/category-colors';
import { getCarListings, getCountyPlaces, getCounties, getUpcomingEvents } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { resolveImageUrl } from '@/lib/images';
import { placeKind, type PlaceKind } from '@/lib/place-kind';
import { countyCapital } from '@/lib/county-facts';
import type { Place } from '@/lib/types';
import { CountyPlacesExplorer } from '@/components/CountyPlacesExplorer';
import { CountySafetyPanel } from '@/components/CountySafetyPanel';
import { CountyLocator } from '@/components/county/CountyLocator';
import { PlaceCard } from '@/components/PlaceCard';
import { EventCard } from '@/components/EventCard';
import { CarListingCard } from '@/components/CarListingCard';
import { SafeImage } from '@/components/SafeImage';
import { JsonLd } from '@/components/JsonLd';
import { countyJsonLd } from '@/lib/structured-data';

// SEO (product review readout, Aug 25, 2026): "each ... county ... should
// eventually have its own properly structured page so LIBERIA360 can rank
// for searches such as ... 'Hotels in Sinkor.'" A real title/description
// per county, not the generic app-wide default.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const counties = await getCounties();
  const county = counties.find((c) => c.slug === slug);
  if (!county) {
    return { title: 'County — LIBERIA360' };
  }
  return {
    title: `Things to do in ${county.name} County — LIBERIA360`,
    description: `Discover places to visit, stay, eat, and explore in ${county.name} County, Liberia.`,
  };
}

/** Highlights: the best-rated places worth a trip, photos first. */
function pickHighlights(places: Place[], kinds: Map<string, PlaceKind>): Place[] {
  const score = (p: Place) =>
    (p.images.length > 0 ? 2 : 0) + (kinds.get(p.id) === 'destination' ? 1.5 : 0) + Number(p.rating || 0) / 5 + Math.min(p.reviewCount, 20) / 40;
  return [...places]
    .filter((p) => {
      const kind = kinds.get(p.id);
      return kind !== 'health' && kind !== 'service';
    })
    .sort((a, b) => score(b) - score(a))
    .slice(0, 3);
}

// A county's front door: where it sits in Liberia, what it's known for,
// the places worth the drive, what's on, how to get around, and the
// safety basics — then the full catalog to dig through.
export default async function CountyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [counties, placesResult] = await Promise.all([
    getCounties(),
    getCountyPlaces(slug, { limit: 50 }).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  ]);

  const county = counties.find((c) => c.slug === slug);
  if (!county || !placesResult) {
    notFound();
  }

  const t = await getTranslations('countyPage');
  const [eventsResult, carsResult] = await Promise.all([
    getUpcomingEvents({ county: county.slug, limit: 4 }).catch(() => null),
    getCarListings({ countyId: county.id, limit: 2 }).catch(() => null),
  ]);
  const events = eventsResult?.data ?? [];
  const cars = carsResult?.data ?? [];

  const places = placesResult.data;
  const total = placesResult.meta.total;
  const kinds = new Map(places.map((p) => [p.id, placeKind(p)]));
  const countKind = (k: PlaceKind) => places.filter((p) => kinds.get(p.id) === k).length;
  // Kind counts are only shown when every place is loaded — a partial
  // tally would undercount.
  const fullyLoaded = places.length === total;
  const highlights = pickHighlights(places, kinds);
  const coverPlace = highlights.find((p) => p.images.length > 0) ?? places.find((p) => p.images.length > 0);
  const cover = coverPlace ? resolveImageUrl(coverPlace.images[0]) : null;
  const capital = countyCapital(county.slug);
  const tint = colorForCounty(county.slug);
  const growing = county.rolloutStage > 1;

  const stats = [
    { label: t('statPlaces', { count: total }), value: total },
    ...(fullyLoaded
      ? [
          { label: t('statSee', { count: countKind('destination') }), value: countKind('destination') },
          { label: t('statStay', { count: countKind('stay') }), value: countKind('stay') },
          { label: t('statEat', { count: countKind('eat') }), value: countKind('eat') },
        ]
      : []),
    { label: t('statEvents', { count: events.length }), value: events.length },
  ].filter((s, i) => i === 0 || s.value > 0);

  const sections = [
    highlights.length > 0 && { id: 'highlights', label: t('navHighlights') },
    events.length > 0 && { id: 'events', label: t('navEvents') },
    { id: 'all-places', label: t('navAll') },
    cars.length > 0 && { id: 'getting-around', label: t('navCars') },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <main className="pb-12">
      <JsonLd data={countyJsonLd(county, places)} />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <header className="relative isolate overflow-hidden bg-slate-950 text-white">
        {cover && (
          <SafeImage
            src={cover}
            alt=""
            loading="eager"
            className="absolute inset-0 -z-20 h-full w-full object-cover opacity-60"
            fallback={null}
          />
        )}
        <span
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `linear-gradient(100deg, rgb(2 6 23 / 0.92) 0%, rgb(2 6 23 / 0.7) 45%, rgb(2 6 23 / 0.25) 100%), linear-gradient(to top, color-mix(in srgb, ${tint} 55%, transparent), transparent 60%)`,
          }}
        />
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-end lg:px-10">
          <div className="flex min-w-0 flex-col gap-4">
            <nav aria-label={t('breadcrumb')} className="flex items-center gap-1 text-sm text-white/60">
              <Link href="/counties" className="hover:text-white">
                {t('counties')}
              </Link>
              <ChevronRightIcon aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
              <span aria-current="page" className="text-white/85">{county.name}</span>
            </nav>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ring-2 ring-white/20"
                style={{ backgroundColor: tint }}
              >
                <CountyIcon county={county} className="h-6 w-6 text-white" />
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gold-300">{t('eyebrow')}</p>
            </div>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl">
              {county.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/75">
              {capital && (
                <span className="flex items-center gap-1.5">
                  <BuildingLibraryIcon aria-hidden className="h-4 w-4 text-gold-300" />
                  {t('capital', { city: capital })}
                </span>
              )}
              {coverPlace && (
                <Link href={`/places/${coverPlace.slug}`} className="flex items-center gap-1.5 hover:text-white">
                  <MapPinIcon aria-hidden className="h-4 w-4 text-gold-300" />
                  {t('photo', { place: coverPlace.name })}
                </Link>
              )}
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {stats.map((s) => (
                <li key={s.label} className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset ring-white/20 backdrop-blur-md">
                  {s.label}
                </li>
              ))}
              {growing && (
                <li className="rounded-full bg-gold-400/90 px-3.5 py-1.5 text-sm font-bold text-slate-950">{t('growing')}</li>
              )}
            </ul>
          </div>
          <div className="w-full max-w-[17rem] rounded-3xl bg-black/30 p-4 ring-1 ring-inset ring-white/15 backdrop-blur-md">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-white/60">{t('whereIsIt')}</p>
            <CountyLocator counties={counties} currentSlug={county.slug} />
          </div>
        </div>
      </header>

      {sections.length > 1 && (
        <nav aria-label={t('onThisPage')} className="sticky top-[4.5rem] z-10 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-10 [scrollbar-width:none]">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-brand-50 hover:text-brand-800 dark:text-slate-300 dark:hover:bg-brand-950/40 dark:hover:text-brand-200">
                {s.label}
              </a>
            ))}
          </div>
        </nav>
      )}

      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pt-8 sm:px-6 sm:pt-10 lg:px-10">
        {highlights.length > 0 && (
          <section id="highlights" aria-labelledby="highlights-title" className="scroll-mt-32">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sunset-700 dark:text-sunset-300">{t('highlightsEyebrow')}</p>
            <h2 id="highlights-title" className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
              {t('highlightsTitle', { county: county.name })}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((place, i) => (
                <PlaceCard key={place.id} place={place} index={i} />
              ))}
            </div>
          </section>
        )}

        {events.length > 0 && (
          <section id="events" aria-labelledby="events-title" className="scroll-mt-32">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sunset-700 dark:text-sunset-300">{t('eventsEyebrow')}</p>
                <h2 id="events-title" className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
                  {t('eventsTitle', { county: county.name })}
                </h2>
              </div>
              <Link href={`/events?county=${county.slug}`} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                {t('seeAllEvents')}
              </Link>
            </div>
            <div className="-mx-4 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {events.map((event) => (
                <div key={event.id} className="shrink-0 snap-start">
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* On phones the safety basics come before the long catalog; on
            desktop they live in the sticky sidebar instead. */}
        <CountySafetyPanel county={county} headingId="before-you-go-mobile" className="flex lg:hidden" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section id="all-places" aria-labelledby="all-title" className="min-w-0 scroll-mt-32">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-700 dark:text-brand-300">{t('allEyebrow')}</p>
            <h2 id="all-title" className="mb-5 mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
              {t('allTitle', { county: county.name })}
            </h2>
            {places.length === 0 ? (
              <div className="flex flex-col items-start gap-3 rounded-[2rem] border border-dashed border-slate-300 px-6 py-10 dark:border-slate-700">
                <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-50">{t('emptyTitle', { county: county.name })}</p>
                <p className="text-slate-600 dark:text-slate-300">{t('emptyBody')}</p>
                <Link href="/places/submit" className="inline-flex min-h-11 items-center rounded-full bg-brand-700 px-5 text-sm font-semibold text-white hover:bg-brand-800">
                  {t('addPlace')}
                </Link>
              </div>
            ) : (
              <CountyPlacesExplorer places={places} countyName={county.name} />
            )}
          </section>

          <aside className="flex flex-col gap-6 lg:sticky lg:top-36 lg:self-start">
            <CountySafetyPanel county={county} className="hidden lg:flex" />

            {cars.length > 0 && (
              <section id="getting-around" aria-labelledby="cars-title" className="flex scroll-mt-32 flex-col gap-3">
                <h2 id="cars-title" className="font-display text-lg font-bold text-slate-950 dark:text-slate-50">{t('carsTitle')}</h2>
                {cars.map((car) => (
                  <CarListingCard key={car.id} listing={car} />
                ))}
                <Link href={`/car-rentals?countyId=${county.id}`} className="text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
                  {t('seeAllCars', { county: county.name })}
                </Link>
              </section>
            )}

            <section className="rounded-[2rem] bg-brand-950 p-5 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-300">{t('planEyebrow')}</p>
              <h2 className="mt-1 font-display text-lg font-bold">{t('planTitle', { county: county.name })}</h2>
              <p className="mt-2 text-sm leading-6 text-white/75">{t('planBody')}</p>
              <Link href="/trips/new" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-gold-400 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-gold-300">
                {t('planCta')}
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
