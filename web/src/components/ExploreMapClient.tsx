'use client';

import { useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AdjustmentsHorizontalIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon as LocateIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import { MapPinIcon as ResultPinIcon, StarIcon } from '@heroicons/react/20/solid';
import 'leaflet/dist/leaflet.css';
import type { Category, County, Place } from '@/lib/types';
import { colorForCategory, gradientForCategory } from '@/lib/category-colors';
import { formatRating } from '@/lib/format';
import { distanceKm, type Coordinates } from '@/lib/geo';
import { isOpenAt } from '@/lib/opening-hours';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { CategoryIcon, iconSvgMarkup } from '@/lib/icons';
import { SafeImage } from './SafeImage';
import { SaveIconButton } from './SaveIconButton';
import { DropdownOption, MobileFilterSheet, PRICE_BUCKETS, priceBucketLabelKey } from './MobileFilterSheet';

const MONROVIA_CENTER: [number, number] = [6.3106, -10.8047];

// Product feedback (Aug 27, 2026): once located, Explore should behave like
// a real "near me" — only what's actually close, not the whole catalog with
// a recentered map. 5km, not a picker like Near Me's page offers: Explore's
// job is a quick glance at what's around you right now, not a distance
// picker.
const NEARBY_RADIUS_KM = 5;

// "You are here" — a pulsing blue dot, the same convention as every map
// app, distinct from every category pin so it's never mistaken for a place.
const USER_LOCATION_ICON = L.divIcon({
  className: '',
  html: '<div class="relative flex h-5 w-5 items-center justify-center"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60"></span><span class="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-md"></span></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function pinIcon(color: string, icon: string | null, categorySlug: string, selected: boolean) {
  return L.divIcon({
    className: '',
    // Leaflet's divIcon renders a raw HTML string, not JSX, so the
    // category's icon has to be serialized to markup up front — see
    // iconSvgMarkup's doc comment.
    html: `<div style="background:${color}" class="flex ${selected ? 'h-10 w-10' : 'h-8 w-8'} -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-md ${selected ? 'ring-2 ring-offset-1 ring-slate-900' : ''}">${iconSvgMarkup(icon, 'h-4 w-4 text-white', categorySlug)}</div>`,
    iconSize: selected ? [40, 40] : [32, 32],
    iconAnchor: selected ? [20, 20] : [16, 16],
    popupAnchor: [0, -16],
  });
}

// Leaflet's built-in geolocation ("locate me") — must live inside
// <MapContainer> to reach the map instance via useMap(). Recentering +
// zooming is Leaflet's own map.locate({ setView: true }), not raw
// navigator.geolocation, so permission prompts/accuracy circle/etc. all
// come for free. `onLocated` hands the found coordinates up to the parent —
// drives both the "you are here" marker and the within-5km filter.
function LocateControl({ located, onLocated }: { located: boolean; onLocated: (coords: Coordinates) => void }) {
  const t = useTranslations('explore');
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMapEvents({
    locationfound: (e) => {
      setLocating(false);
      onLocated({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    locationerror: () => {
      setLocating(false);
      setError(t('locationError'));
    },
  });

  return (
    <div className="pointer-events-none absolute bottom-3 start-3 z-[1000] flex flex-col items-start gap-1.5">
      {error && (
        <span className="pointer-events-auto max-w-[10rem] rounded-lg bg-white/95 px-2 py-1 text-xs text-flag-700 shadow dark:bg-slate-800/95 dark:text-flag-300">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          setLocating(true);
          setError(null);
          map.locate({ setView: true, maxZoom: 14 });
        }}
        disabled={locating}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-md transition-colors hover:text-brand-700 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-brand-300"
      >
        <LocateIcon aria-hidden className="h-5 w-5" />
        {locating ? t('locating') : located ? t('updateLocation') : t('useMyLocation')}
      </button>
    </div>
  );
}

// A filter pill that opens a small dropdown panel below it. `children` is a
// render prop handed a `close()` — County and Price call it after picking a
// single option (the dropdown's job is done); Category doesn't, since
// picking one checkbox shouldn't close a multi-select list. The full-screen
// transparent button behind the open panel is the outside-click-to-close;
// it's `aria-hidden`/untabbable so it never becomes a real focus stop.
//
// The panel and its backdrop use a very high z-index deliberately: this
// header sits directly above the Leaflet map, and Leaflet's own panes/
// controls carry z-index values up to 1000 (and some of Leaflet's own
// panes establish their own stacking context via the transform they use
// for pan/zoom, which can make an ordinary z-50 lose to them in ways that
// don't reproduce consistently in every browser). Comfortably clearing
// Leaflet's own maximum avoids that fight entirely rather than chasing it.
function FilterPopover({
  label,
  icon: Icon,
  active,
  children,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
          active
            ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-300'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <Icon aria-hidden className="h-4 w-4" />
        {label}
        <ChevronDownIcon aria-hidden className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[9998] cursor-default"
          />
          <div className="absolute left-0 top-full z-[9999] mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

// Result card for the sheet below the map — a fuller preview than a map
// popup (image, category, county, rating) with its own "View details" link
// alongside the row's own link, so either the whole row or just that button
// gets a visitor to the place. `selected` mirrors whichever marker was last
// clicked on the map, so the two stay in sync without the row needing to
// drive navigation itself.
function ExploreResultRow({ place, selected }: { place: Place; selected: boolean }) {
  const t = useTranslations('explore');
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
  const coverThumb = place.images[0] ? resolveThumbUrl(place.images[0]) : null;

  return (
    <div className={`flex items-center gap-3 py-3 transition-colors ${selected ? 'bg-brand-50/70 dark:bg-brand-900/20' : ''}`}>
      <Link href={`/places/${place.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        <SafeImage
          src={cover}
          thumbSrc={coverThumb}
          alt=""
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
          fallback={
            <div
              aria-hidden
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundImage: gradientForCategory(place.category.slug) }}
            >
              <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-6 w-6 text-white/90" />
            </div>
          }
        />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: colorForCategory(place.category.slug) }}
          >
            {place.category.name}
          </p>
          <p className="truncate font-display font-semibold leading-snug text-slate-900 dark:text-slate-50">{place.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400">
            <ResultPinIcon aria-hidden className="h-3.5 w-3.5 shrink-0" />
            {place.county.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            {place.reviewCount > 0 && <StarIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-gold-500" />}
            {formatRating(place.rating, place.reviewCount)}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <SaveIconButton slug={place.slug} placeId={place.id} />
        <Link
          href={`/places/${place.slug}`}
          className="whitespace-nowrap rounded-full bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-800"
        >
          {t('viewDetails')}
        </Link>
      </div>
    </div>
  );
}

// Explore (Map) screen (Tech Spec §4.1, §3.1). Redesign (Aug 27, 2026 —
// "make the users experience go wow"): the map used to be full-bleed with
// filter chips and a result strip floating on top of it — usable, but
// visually flat and cramped once anything but category filtering was
// needed. This gives Explore the same weight as a real discovery screen: a
// proper header with a search box and dropdown filters (Category, County,
// Open now, Price — the same filter set Search offers, applied client-side
// against the places this page already fetched), the map filling the
// space between, and a real results sheet below it instead of a thumbnail
// strip pinned to the map's bottom edge.
//
// Mobile filter UX pass (Sep 6, 2026): below lg, the row of FilterPopover
// dropdowns above is hidden in favor of a single "Filters" button that
// opens MobileFilterSheet — a full-width slide-up sheet, the idiomatic
// mobile pattern, in place of several small dropdowns anchored under
// filter pills (workable on desktop's wider, mouse-driven layout, awkward
// one-handed on a phone). Both surfaces drive the exact same filter
// state, so switching between a wide and narrow viewport never loses or
// duplicates a selection.
export function ExploreMapClient({
  places,
  categories,
  counties,
}: {
  places: Place[];
  categories: Category[];
  counties: County[];
}) {
  const t = useTranslations('explore');
  const tCommon = useTranslations('common');
  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set(categories.map((c) => c.slug)));
  const [countySlug, setCountySlug] = useState<string | null>(null);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [priceBucketId, setPriceBucketId] = useState('');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const priceBucket = PRICE_BUCKETS.find((bucket) => bucket.id === priceBucketId);

  const visiblePlaces = useMemo(() => {
    const now = new Date();
    const q = query.trim().toLowerCase();
    return places.filter((place) => {
      if (!activeSlugs.has(place.category.slug)) return false;
      if (countySlug && place.county.slug !== countySlug) return false;
      if (openNowOnly && !isOpenAt(place.structuredHours, now)) return false;
      if (priceBucket && priceBucket.id !== '') {
        if (place.estimatedCostEntry == null) return false;
        if (priceBucket.min != null && place.estimatedCostEntry < priceBucket.min) return false;
        if (priceBucket.max != null && place.estimatedCostEntry > priceBucket.max) return false;
      }
      if (q && !place.name.toLowerCase().includes(q) && !place.description.toLowerCase().includes(q)) return false;
      if (userLocation && distanceKm(userLocation, { lat: place.latitude, lng: place.longitude }) > NEARBY_RADIUS_KM) return false;
      return true;
    });
  }, [places, activeSlugs, countySlug, openNowOnly, priceBucket, query, userLocation]);

  function toggleCategory(slug: string) {
    setActiveSlugs((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  const allCategoriesActive = activeSlugs.size === categories.length;
  const hasActiveFilters =
    !allCategoriesActive || countySlug !== null || openNowOnly || priceBucketId !== '' || query.trim() !== '' || userLocation !== null;

  function clearFilters() {
    setActiveSlugs(new Set(categories.map((c) => c.slug)));
    setCountySlug(null);
    setOpenNowOnly(false);
    setPriceBucketId('');
    setQuery('');
    setUserLocation(null);
  }

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-slate-950">
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-slate-50 sm:text-2xl">{t('title')}</h1>

        <div className="relative">
          <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaces')}
            aria-label={t('searchPlaces')}
            className="w-full rounded-full border border-slate-300 bg-white py-3 ps-11 pe-4 text-sm text-slate-900 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:ring-brand-900/40"
          />
        </div>

        {/* lg+ only — see MobileFilterSheet's doc comment for the
            mobile-width replacement below. flex-wrap, not overflow-x-auto —
            a scrolling row would force overflow-y to `auto` too (CSS
            computes a `visible` axis to `auto` once the other axis is
            non-visible), clipping each dropdown's panel exactly where it
            needs to overflow downward. */}
        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          <FilterPopover label={t('filterCategory')} icon={AdjustmentsHorizontalIcon} active={!allCategoriesActive}>
            {() => (
              <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                <DropdownOption
                  label={t('filterAllCategories')}
                  selected={allCategoriesActive}
                  onClick={() => setActiveSlugs(new Set(categories.map((c) => c.slug)))}
                />
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={activeSlugs.has(category.slug)}
                      onChange={() => toggleCategory(category.slug)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500 dark:border-slate-600"
                    />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center" style={{ color: colorForCategory(category.slug) }}>
                      <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-4 w-4" />
                    </span>
                    {category.name}
                  </label>
                ))}
              </div>
            )}
          </FilterPopover>

          <FilterPopover label={t('filterCounty')} icon={LocateIcon} active={countySlug !== null}>
            {(close) => (
              <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                <DropdownOption label={t('filterAllCounties')} selected={countySlug === null} onClick={() => { setCountySlug(null); close(); }} />
                {counties.map((county) => (
                  <DropdownOption
                    key={county.id}
                    label={county.name}
                    selected={countySlug === county.slug}
                    onClick={() => { setCountySlug(county.slug); close(); }}
                  />
                ))}
              </div>
            )}
          </FilterPopover>

          <button
            type="button"
            onClick={() => setOpenNowOnly((value) => !value)}
            aria-pressed={openNowOnly}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              openNowOnly
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-300'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <ClockIcon aria-hidden className="h-4 w-4" />
            {t('filterOpenNow')}
          </button>

          <FilterPopover label={t('filterPrice')} icon={TagIcon} active={priceBucketId !== ''}>
            {(close) => (
              <div className="flex flex-col gap-0.5">
                {PRICE_BUCKETS.map((bucket) => (
                  <DropdownOption
                    key={bucket.id}
                    label={tCommon(priceBucketLabelKey(bucket.id))}
                    selected={priceBucketId === bucket.id}
                    onClick={() => { setPriceBucketId(bucket.id); close(); }}
                  />
                ))}
              </div>
            )}
          </FilterPopover>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 whitespace-nowrap px-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t('clear')}
            </button>
          )}
        </div>

        {/* Mobile only — a single trigger opening MobileFilterSheet in
            place of the dropdown row above. */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-haspopup="dialog"
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
              hasActiveFilters
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-900/40 dark:text-brand-300'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            <AdjustmentsHorizontalIcon aria-hidden className="h-4 w-4" />
            {t('filters')}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 whitespace-nowrap px-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300"
            >
              {t('clear')}
            </button>
          )}
        </div>
      </div>

      <MobileFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        categories={categories}
        activeSlugs={activeSlugs}
        allCategoriesActive={allCategoriesActive}
        onToggleCategory={toggleCategory}
        onSelectAllCategories={() => setActiveSlugs(new Set(categories.map((c) => c.slug)))}
        counties={counties}
        countySlug={countySlug}
        onSelectCounty={setCountySlug}
        openNowOnly={openNowOnly}
        onToggleOpenNow={() => setOpenNowOnly((value) => !value)}
        priceBucketId={priceBucketId}
        onSelectPriceBucket={setPriceBucketId}
        hasActiveFilters={hasActiveFilters}
        onClear={clearFilters}
        resultCount={visiblePlaces.length}
      />

      <div className="relative min-h-[220px] flex-1">
        <MapContainer center={MONROVIA_CENTER} zoom={11} scrollWheelZoom className="h-full w-full">
          {/* CARTO's basemap tiles, not tile.openstreetmap.org directly —
              OSM's own tile servers are explicitly not meant for production
              traffic (see their tile usage policy) and can silently rate-limit
              or block requests; CARTO's free basemap tiles are the same map
              data (still OSM-sourced, hence the dual attribution below) served
              from infrastructure meant to be used this way. No API key. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
            subdomains="abcd"
          />
          <LocateControl located={userLocation !== null} onLocated={setUserLocation} />
          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_LOCATION_ICON} zIndexOffset={1000} />
          )}
          {visiblePlaces.map((place) => (
            <Marker
              key={place.id}
              position={[place.latitude, place.longitude]}
              icon={pinIcon(colorForCategory(place.category.slug), place.category.icon, place.category.slug, place.id === selectedId)}
              eventHandlers={{ click: () => setSelectedId(place.id) }}
            >
              <Popup>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold text-slate-900 dark:text-slate-50">{place.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{place.category.name}</p>
                  <Link
                    href={`/places/${place.slug}`}
                    className="flex items-center gap-0.5 text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
                  >
                    {t('viewDetails')}
                    <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Results sheet — the same places the map shows, as full cards
          instead of a thumbnail strip. Clicking a marker highlights its row
          here (selectedId); the rows themselves just link straight to the
          place, same as everywhere else in the app. */}
      <div className="flex max-h-[38vh] shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 pt-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
            {userLocation ? t('resultsWithinKm', { km: NEARBY_RADIUS_KM }) : t('resultsNearYou')}{' '}
            <span className="font-normal text-slate-400 dark:text-slate-500">· {visiblePlaces.length}</span>
          </h2>
          <Link href="/search" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
            {tCommon('seeAll')}
          </Link>
        </div>
        <div className="flex flex-col divide-y divide-slate-100 overflow-y-auto pb-3 dark:divide-slate-800">
          {visiblePlaces.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">{t('noResultsMatchFilters')}</p>
          ) : (
            visiblePlaces.map((place) => <ExploreResultRow key={place.id} place={place} selected={place.id === selectedId} />)
          )}
        </div>
      </div>
    </div>
  );
}
