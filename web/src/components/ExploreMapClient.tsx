'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ClockIcon,
  CursorArrowRaysIcon,
  MagnifyingGlassIcon,
  MapIcon,
  MapPinIcon as PinOutlineIcon,
  PlusIcon,
  SignalSlashIcon,
  TagIcon,
  ViewfinderCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { MapPinIcon as PinSolidIcon, StarIcon } from '@heroicons/react/20/solid';
import 'leaflet/dist/leaflet.css';
import type { Category, County, Place } from '@/lib/types';
import { BASEMAP_ATTRIBUTION, BASEMAP_TILE_URL } from '@/lib/map-tiles';
import { colorForCategory, gradientForCategory } from '@/lib/category-colors';
import { formatRating } from '@/lib/format';
import type { Coordinates } from '@/lib/geo';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { CategoryIcon, iconSvgMarkup } from '@/lib/icons';
import { LOCATION_MAX_AGE_MS, LOCATION_TIMEOUT_MS } from '@/lib/geolocation';
import { recordSearch } from '@/lib/analytics-api';
import {
  EMPTY_FILTERS,
  RADIUS_OPTIONS_KM,
  activeFilterCount,
  filterPlaces,
  formatDistance,
  loadOrigin,
  parseExploreParams,
  saveOrigin,
  serializeExploreParams,
  type ExploreFilters,
  type PlaceResult,
  type StoredOrigin,
} from '@/lib/explore-filters';
import { SafeImage } from './SafeImage';
import { SaveIconButton } from './SaveIconButton';
import { AddToTripButton } from './AddToTripButton';
import { DropdownOption, MobileFilterSheet, PRICE_BUCKETS, priceBucketLabelKey } from './MobileFilterSheet';

const MONROVIA_CENTER: [number, number] = [6.3106, -10.8047];
const LIBERIA_ZOOM = 8;

// The visitor's point: a solid dot for the device location, a ring for a
// point they tapped, so the two are never confused with a place pin.
function originIcon(source: StoredOrigin['source']) {
  return L.divIcon({
    className: '',
    html:
      source === 'device'
        ? '<div class="flex h-5 w-5 items-center justify-center"><span class="h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-md"></span></div>'
        : '<div class="flex h-6 w-6 items-center justify-center rounded-full border-[3px] border-sunset-600 bg-white/80 shadow-md"><span class="h-1.5 w-1.5 rounded-full bg-sunset-600"></span></div>',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function pinIcon(place: Place, state: 'idle' | 'hover' | 'selected') {
  const color = colorForCategory(place.category.slug);
  const big = state !== 'idle';
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="flex ${big ? 'h-11 w-11' : 'h-8 w-8'} items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform ${state === 'selected' ? 'ring-4 ring-sunset-500/70' : ''}">${iconSvgMarkup(place.category.icon, big ? 'h-5 w-5 text-white' : 'h-4 w-4 text-white', place.category.slug)}</div>`,
    iconSize: big ? [44, 44] : [32, 32],
    iconAnchor: big ? [22, 22] : [16, 16],
  });
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

// ---------------------------------------------------------------------------
// Map helpers (must live inside <MapContainer> to reach the map)

interface FocusRequest {
  lat: number;
  lng: number;
  zoom?: number;
  nonce: number;
}

// Moves the map to a requested point. `bottomInset` is how much of the map
// the mobile sheet covers, so the point lands in the visible part.
function MapFocus({ request, bottomInset }: { request: FocusRequest | null; bottomInset: number }) {
  const map = useMap();
  useEffect(() => {
    if (!request) return;
    const zoom = Math.max(map.getZoom(), request.zoom ?? 14);
    const target = map.project([request.lat, request.lng], zoom).add([0, bottomInset / 2]);
    const center = map.unproject(target, zoom);
    if (prefersReducedMotion()) map.setView(center, zoom, { animate: false });
    else map.flyTo(center, zoom, { duration: 0.6 });
    // Only a new request moves the map; inset changes alone don't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.nonce]);
  return null;
}

// Frames every result whenever the filters change (not on selection, so
// picking a place never zooms the map out from under you).
function FitResults({
  results,
  fitKey,
  origin,
  radiusKm,
  bottomInset,
}: {
  results: PlaceResult[];
  fitKey: string;
  origin: Coordinates | null;
  radiusKm: number;
  bottomInset: number;
}) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      // A restored selection is focused by MapFocus instead.
      if (new URLSearchParams(window.location.search).get('place')) return;
    }
    const animate = !prefersReducedMotion();
    if (origin) {
      map.fitBounds(L.latLng(origin.lat, origin.lng).toBounds(radiusKm * 2000), { animate, paddingTopLeft: [24, 24], paddingBottomRight: [24, 24 + bottomInset] });
      return;
    }
    if (results.length === 0) return;
    const bounds = L.latLngBounds(results.map((r) => [r.place.latitude, r.place.longitude] as [number, number]));
    map.fitBounds(bounds, { animate, paddingTopLeft: [40, 40], paddingBottomRight: [40, 40 + bottomInset], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  return null;
}

function TapToSetPoint({ active, onPick }: { active: boolean; onPick: (coords: Coordinates) => void }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = active ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [active, map]);
  useMapEvents({
    click: (e) => {
      if (active) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ---------------------------------------------------------------------------
// Toolbar pieces

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={pillClass(active)}>
        <Icon aria-hidden className="h-4 w-4" />
        {label}
        <ChevronDownIcon aria-hidden className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-[9998] cursor-default" />
          <div className="absolute start-0 top-full z-[9999] mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {children(() => setOpen(false))}
          </div>
        </>
      )}
    </div>
  );
}

function pillClass(active: boolean): string {
  return `inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
    active
      ? 'border-brand-700 bg-brand-700 text-white hover:bg-brand-800 dark:border-brand-400 dark:bg-brand-500 dark:text-brand-950'
      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
  }`;
}

// ---------------------------------------------------------------------------
// Results

function ResultRow({
  result,
  selected,
  onShowOnMap,
  onHover,
  rowRef,
}: {
  result: PlaceResult;
  selected: boolean;
  onShowOnMap: () => void;
  onHover: (hovering: boolean) => void;
  rowRef: (el: HTMLLIElement | null) => void;
}) {
  const t = useTranslations('explore');
  const { place, distanceKm } = result;
  const cover = place.images[0] ? resolveImageUrl(place.images[0]) : null;
  const coverThumb = place.images[0] ? resolveThumbUrl(place.images[0]) : null;
  const href = `/places/${place.slug}`;

  return (
    <li
      ref={rowRef}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`scroll-my-3 rounded-2xl border p-2.5 transition-colors motion-reduce:transition-none ${
        selected
          ? 'border-sunset-500 bg-sunset-50/70 shadow-card dark:border-sunset-400 dark:bg-sunset-900/20'
          : 'border-transparent hover:border-slate-200 hover:bg-white dark:hover:border-slate-800 dark:hover:bg-slate-900'
      }`}
    >
      <div className="flex gap-3">
        <Link href={href} tabIndex={-1} aria-hidden className="shrink-0">
          <SafeImage
            src={cover}
            thumbSrc={coverThumb}
            alt=""
            className="h-20 w-20 rounded-xl object-cover sm:h-24 sm:w-24"
            fallback={
              <div
                className="flex h-20 w-20 items-center justify-center rounded-xl sm:h-24 sm:w-24"
                style={{ backgroundImage: gradientForCategory(place.category.slug) }}
              >
                <CategoryIcon iconKey={place.category.icon} categorySlug={place.category.slug} className="h-7 w-7 text-white/90" />
              </div>
            }
          />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-[11px] font-bold uppercase tracking-wide" style={{ color: colorForCategory(place.category.slug) }}>
            {place.category.name}
          </p>
          <h3 className="font-display text-base font-bold leading-snug text-slate-950 dark:text-slate-50">
            <Link href={href} className="line-clamp-2 rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              {place.name}
            </Link>
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-0.5">
              <PinSolidIcon aria-hidden className="h-3.5 w-3.5" />
              {place.county.name}
            </span>
            {distanceKm !== null && <span className="font-semibold text-brand-700 dark:text-brand-300">{formatDistance(distanceKm)}</span>}
            {place.reviewCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <StarIcon aria-hidden className="h-3.5 w-3.5 text-gold-500" />
                {formatRating(place.rating, place.reviewCount)}
              </span>
            )}
            {place.estimatedCostEntry != null && (
              <span>{place.estimatedCostEntry === 0 ? t('freeEntry') : t('entryCost', { price: `US$${place.estimatedCostEntry}` })}</span>
            )}
          </p>
          <div className="mt-auto flex items-center gap-1.5 pt-2">
            <button
              type="button"
              onClick={onShowOnMap}
              aria-label={t('showOnMap', { name: place.name })}
              aria-pressed={selected}
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-200"
            >
              <MapIcon aria-hidden className="h-4 w-4" />
              {t('map')}
            </button>
            <SaveIconButton slug={place.slug} placeId={place.id} className="!h-9 !w-9 border border-slate-200 !shadow-none dark:border-slate-700" />
            <AddToTripButton contentType="place" itemId={place.id} itemName={place.name} compact />
          </div>
        </div>
      </div>
    </li>
  );
}

type SheetSnap = 'peek' | 'half' | 'full';

// Mobile: the list lives in a sheet over the map. Drag the handle (or tap
// it, or use the keyboard) to move between a peek, half and full height.
function BottomSheet({
  snap,
  onSnap,
  header,
  children,
  onHeightChange,
}: {
  snap: SheetSnap;
  onSnap: (snap: SheetSnap) => void;
  header: ReactNode;
  children: ReactNode;
  onHeightChange: (px: number) => void;
}) {
  const t = useTranslations('explore');
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startHeight: number } | null>(null);
  const [dragHeight, setDragHeight] = useState<number | null>(null);

  const parentHeight = () => sheetRef.current?.parentElement?.clientHeight ?? window.innerHeight;
  const snapHeights = useCallback(() => {
    const h = parentHeight();
    return { peek: 132, half: Math.round(h * 0.5), full: h - 24 } as Record<SheetSnap, number>;
  }, []);

  const [heights, setHeights] = useState(() => ({ peek: 132, half: 320, full: 600 }) as Record<SheetSnap, number>);
  useEffect(() => {
    const update = () => setHeights(snapHeights());
    update();
    const parent = sheetRef.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [snapHeights]);

  const height = dragHeight ?? heights[snap];
  useEffect(() => onHeightChange(heights[snap]), [heights, snap, onHeightChange]);

  function onPointerDown(e: ReactPointerEvent) {
    drag.current = { startY: e.clientY, startHeight: heights[snap] };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: ReactPointerEvent) {
    if (!drag.current) return;
    const next = drag.current.startHeight + (drag.current.startY - e.clientY);
    setDragHeight(Math.min(heights.full, Math.max(heights.peek, next)));
  }
  function onPointerUp(e: ReactPointerEvent) {
    if (!drag.current) return;
    const moved = Math.abs(drag.current.startY - e.clientY);
    drag.current = null;
    if (moved < 6 || dragHeight === null) {
      // A tap toggles between peek and half.
      setDragHeight(null);
      onSnap(snap === 'peek' ? 'half' : 'peek');
      return;
    }
    const nearest = (Object.keys(heights) as SheetSnap[]).reduce((best, key) =>
      Math.abs(heights[key] - dragHeight) < Math.abs(heights[best] - dragHeight) ? key : best,
    );
    setDragHeight(null);
    onSnap(nearest);
  }

  return (
    <div
      ref={sheetRef}
      style={{ height }}
      className={`absolute inset-x-0 bottom-0 z-[1001] flex flex-col rounded-t-[1.75rem] bg-[var(--surface-canvas)] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)] dark:bg-slate-950 ${
        dragHeight === null ? 'transition-[height] duration-300 ease-out motion-reduce:transition-none' : ''
      }`}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragHeight(null);
        }}
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2.5 active:cursor-grabbing"
      >
        <button
          type="button"
          onClick={(e) => {
            // Pointer taps are handled above; this is for keyboards.
            if (e.detail === 0) onSnap(snap === 'full' ? 'peek' : snap === 'peek' ? 'half' : 'full');
          }}
          aria-expanded={snap !== 'peek'}
          aria-label={snap === 'peek' ? t('showList') : snap === 'half' ? t('expandList') : t('showMap')}
          className="mx-auto mb-2 flex h-6 w-16 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </button>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type LocateStatus = 'idle' | 'locating' | 'denied' | 'unavailable' | 'picking';

// Explore: search, filter and browse places on a map and a list that stay
// in step. Desktop splits list and map side by side; on phones the list is
// a sheet over the map. Every filter is mirrored in the URL (see
// lib/explore-filters.ts), so opening a place and coming back restores the
// same view. Location is only requested when "Near me" is chosen, and
// tapping a point on the map works as a fallback when it's unavailable.
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
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const online = useOnline();

  const [filters, setFilters] = useState<ExploreFilters>(() => parseExploreParams(new URLSearchParams(window.location.search)));
  const [origin, setOrigin] = useState<StoredOrigin | null>(() => loadOrigin());
  const [locateStatus, setLocateStatus] = useState<LocateStatus>('idle');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [snap, setSnap] = useState<SheetSnap>('half');
  const [sheetHeight, setSheetHeight] = useState(0);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [queryDraft, setQueryDraft] = useState(filters.q);
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const lastRecorded = useRef('');
  const locateRequest = useRef(0);

  // "near=1" in a shared link but no point in this tab: ask again only
  // when the visitor taps Near me, never on load.
  const nearActive = filters.near && origin !== null;

  const update = useCallback((patch: Partial<ExploreFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const qs = serializeExploreParams({ ...filters, near: nearActive });
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, '', url);
    }
  }, [filters, nearActive]);

  // Search text applies as you type (debounced), and is counted once it
  // settles.
  useEffect(() => {
    const handle = setTimeout(() => update({ q: queryDraft }), 200);
    const record = setTimeout(() => {
      const q = queryDraft.trim().toLowerCase();
      if (q.length >= 2 && q !== lastRecorded.current) {
        lastRecorded.current = q;
        recordSearch(q);
      }
    }, 1500);
    return () => {
      clearTimeout(handle);
      clearTimeout(record);
    };
  }, [queryDraft, update]);

  const results = useMemo(
    () => filterPlaces(places, { ...filters, near: nearActive }, origin),
    [places, filters, nearActive, origin],
  );
  const fitKey = serializeExploreParams({ ...filters, near: nearActive, selected: null }) + (origin ? `${origin.lat},${origin.lng}` : '');

  const selectedResult = results.find((r) => r.place.id === filters.selected || r.place.slug === filters.selected) ?? null;
  const selectedId = selectedResult?.place.id ?? null;

  const scrollToRow = useCallback((id: string) => {
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });
  }, []);

  // Restore a selection from the URL (coming back from a place page).
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !selectedResult) return;
    restored.current = true;
    setFocus({ lat: selectedResult.place.latitude, lng: selectedResult.place.longitude, nonce: Date.now() });
    scrollToRow(selectedResult.place.id);
  }, [selectedResult, scrollToRow]);

  function selectFromMap(place: Place) {
    update({ selected: place.slug });
    if (!isDesktop && snap === 'peek') setSnap('half');
    scrollToRow(place.id);
  }

  function selectFromList(place: Place) {
    update({ selected: place.slug });
    if (!isDesktop) setSnap('peek');
    setFocus({ lat: place.latitude, lng: place.longitude, nonce: Date.now() });
  }

  function setPoint(next: StoredOrigin) {
    setOrigin(next);
    saveOrigin(next);
    setLocateStatus('idle');
    update({ near: true, selected: null });
  }

  function requestLocation() {
    if (!('geolocation' in navigator)) {
      setLocateStatus('unavailable');
      return;
    }
    setLocateStatus('locating');
    const request = ++locateRequest.current;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (request === locateRequest.current) setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'device' });
      },
      (err) => {
        if (request === locateRequest.current) setLocateStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: LOCATION_MAX_AGE_MS },
    );
  }

  function toggleNearMe() {
    if (nearActive) {
      update({ near: false });
      return;
    }
    if (origin) {
      update({ near: true, selected: null });
      return;
    }
    requestLocation();
  }

  function startPicking() {
    // A pending device lookup no longer applies once a point is being set.
    locateRequest.current += 1;
    setLocateStatus('picking');
    if (!isDesktop) setSnap('peek');
  }

  function clearAll() {
    setFilters({ ...EMPTY_FILTERS });
    setQueryDraft('');
    setLocateStatus('idle');
  }

  // MobileFilterSheet speaks in "active category set"; here an empty list
  // means every category.
  const allSlugs = categories.map((c) => c.slug);
  const activeSlugs = new Set(filters.categories.length > 0 ? filters.categories : allSlugs);
  const allCategoriesActive = filters.categories.length === 0;
  function toggleCategory(slug: string) {
    const next = new Set(activeSlugs);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    update({ categories: next.size === 0 || next.size === allSlugs.length ? [] : allSlugs.filter((s) => next.has(s)), selected: null });
  }

  const filterCount = activeFilterCount({ ...filters, near: nearActive });
  const hasAnything = filterCount > 0 || filters.q.trim() !== '';
  const categoryLabel =
    filters.categories.length === 1
      ? (categories.find((c) => c.slug === filters.categories[0])?.name ?? t('filterCategory'))
      : filters.categories.length > 1
        ? t('categoriesSelected', { count: filters.categories.length })
        : t('filterCategory');
  const countyName = counties.find((c) => c.slug === filters.county)?.name;

  const locationPanel =
    locateStatus !== 'idle' ? (
      <div role="status" className="flex flex-col gap-2 rounded-2xl border border-sunset-200 bg-sunset-50 p-3 text-sm text-slate-800 dark:border-sunset-900 dark:bg-sunset-900/20 dark:text-slate-100">
        <div className="flex items-start justify-between gap-2">
          <p>
            {locateStatus === 'picking'
              ? t('tapMapHint')
              : locateStatus === 'locating'
                ? t('locatingHint')
                : locateStatus === 'denied'
                ? t('locationDenied')
                : t('locationUnavailable')}
          </p>
          <button
            type="button"
            onClick={() => {
              locateRequest.current += 1;
              setLocateStatus('idle');
            }}
            aria-label={tCommon('cancel')}
            className="-m-1 rounded-full p-1 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:text-slate-200"
          >
            <XMarkIcon aria-hidden className="h-4 w-4" />
          </button>
        </div>
        {locateStatus !== 'picking' && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={startPicking} className={pillClass(false)}>
              <CursorArrowRaysIcon aria-hidden className="h-4 w-4" />
              {t('tapMapToSet')}
            </button>
            <label className="inline-flex items-center gap-2">
              <span className="sr-only">{t('chooseCounty')}</span>
              <select
                value={filters.county ?? ''}
                onChange={(e) => {
                  update({ county: e.target.value || null, selected: null });
                  setLocateStatus('idle');
                }}
                className="min-h-10 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">{t('chooseCounty')}</option>
                {counties.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
    ) : null;

  const listHeader = (
    <div className="flex items-center justify-between gap-2">
      <p className="font-display text-base font-bold text-slate-950 dark:text-slate-50" aria-live="polite">
        {t('resultsCount', { count: results.length })}
        {nearActive && origin && (
          <span className="ms-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
            · {origin.source === 'device' ? t('aroundYou') : t('aroundPoint')}
          </span>
        )}
      </p>
      {hasAnything && (
        <button type="button" onClick={clearAll} className="min-h-9 shrink-0 rounded-full px-2 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          {t('clearAll')}
        </button>
      )}
    </div>
  );

  const nextRadius = RADIUS_OPTIONS_KM.find((r) => r > filters.radiusKm);
  const list =
    results.length === 0 ? (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <PinOutlineIcon aria-hidden className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-50">
          {places.length === 0 ? t('emptyCatalog') : t('noResultsMatchFilters')}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {nearActive && nextRadius && (
            <button type="button" onClick={() => update({ radiusKm: nextRadius })} className={pillClass(true)}>
              {t('widenTo', { km: nextRadius })}
            </button>
          )}
          {hasAnything && (
            <button type="button" onClick={clearAll} className={pillClass(false)}>
              {t('clearAll')}
            </button>
          )}
        </div>
        <Link href="/places/submit" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-300">
          <PlusIcon aria-hidden className="h-4 w-4" />
          {t('addMissingPlace')}
        </Link>
      </div>
    ) : (
      <ul aria-label={t('listLabel')} className="flex flex-col gap-1.5">
        {results.map((result) => (
          <ResultRow
            key={result.place.id}
            result={result}
            selected={result.place.id === selectedId}
            onShowOnMap={() => selectFromList(result.place)}
            onHover={(hovering) => setHoveredId(hovering ? result.place.id : null)}
            rowRef={(el) => {
              if (el) rowRefs.current.set(result.place.id, el);
              else rowRefs.current.delete(result.place.id);
            }}
          />
        ))}
      </ul>
    );

  return (
    <div className="flex h-full w-full flex-col bg-[var(--surface-canvas)] dark:bg-slate-950">
      <div className="relative z-[1002] flex shrink-0 flex-col gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-4 py-3 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
        <div className="flex items-center gap-3">
          <h1 className="hidden shrink-0 font-display text-2xl font-extrabold tracking-tight text-slate-950 dark:text-slate-50 lg:block">{t('title')}</h1>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: queryDraft });
            }}
            className="relative min-w-0 flex-1"
          >
            <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={queryDraft}
              onChange={(e) => setQueryDraft(e.target.value)}
              placeholder={t('searchPlaces')}
              aria-label={t('searchPlaces')}
              className="min-h-12 w-full rounded-full border border-slate-300 bg-white py-3 pe-4 ps-11 text-base text-slate-900 outline-none transition-shadow focus:border-brand-600 focus:ring-4 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:ring-brand-900/40"
            />
          </form>
        </div>

        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible">
          <button
            type="button"
            onClick={toggleNearMe}
            aria-pressed={nearActive}
            disabled={locateStatus === 'locating'}
            className={pillClass(nearActive)}
          >
            <ViewfinderCircleIcon aria-hidden className="h-4 w-4" />
            {locateStatus === 'locating' ? t('locating') : t('nearMe')}
          </button>
          {nearActive && (
            <>
              <label className="inline-flex shrink-0 items-center">
                <span className="sr-only">{t('distance')}</span>
                <select
                  value={filters.radiusKm}
                  onChange={(e) => update({ radiusKm: Number(e.target.value) })}
                  className="min-h-10 rounded-full border border-brand-700 bg-white px-3 text-sm font-semibold text-brand-800 dark:border-brand-400 dark:bg-slate-900 dark:text-brand-200"
                >
                  {RADIUS_OPTIONS_KM.map((km) => (
                    <option key={km} value={km}>
                      {t('withinKm', { km })}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={startPicking} className={pillClass(false)}>
                <CursorArrowRaysIcon aria-hidden className="h-4 w-4" />
                {t('changePoint')}
              </button>
            </>
          )}

          {/* Desktop: individual dropdowns. Phones: one Filters button. */}
          <div className="hidden items-center gap-2 lg:flex">
            <FilterPopover label={categoryLabel} icon={AdjustmentsHorizontalIcon} active={!allCategoriesActive}>
              {() => (
                <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                  <DropdownOption label={t('filterAllCategories')} selected={allCategoriesActive} onClick={() => update({ categories: [], selected: null })} />
                  {categories.map((category) => (
                    <label
                      key={category.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <input
                        type="checkbox"
                        checked={!allCategoriesActive && activeSlugs.has(category.slug)}
                        onChange={() =>
                          allCategoriesActive ? update({ categories: [category.slug], selected: null }) : toggleCategory(category.slug)
                        }
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
            <FilterPopover label={countyName ?? t('filterCounty')} icon={PinOutlineIcon} active={filters.county !== null}>
              {(close) => (
                <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
                  <DropdownOption label={t('filterAllCounties')} selected={filters.county === null} onClick={() => { update({ county: null, selected: null }); close(); }} />
                  {counties.map((county) => (
                    <DropdownOption
                      key={county.id}
                      label={county.name}
                      selected={filters.county === county.slug}
                      onClick={() => { update({ county: county.slug, selected: null }); close(); }}
                    />
                  ))}
                </div>
              )}
            </FilterPopover>
            <FilterPopover
              label={filters.price ? tCommon(priceBucketLabelKey(filters.price)) : t('filterPrice')}
              icon={TagIcon}
              active={filters.price !== ''}
            >
              {(close) => (
                <div className="flex flex-col gap-0.5">
                  {PRICE_BUCKETS.map((bucket) => (
                    <DropdownOption
                      key={bucket.id}
                      label={tCommon(priceBucketLabelKey(bucket.id))}
                      selected={filters.price === bucket.id}
                      onClick={() => { update({ price: bucket.id, selected: null }); close(); }}
                    />
                  ))}
                  <p className="px-2 pt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{t('priceNote')}</p>
                </div>
              )}
            </FilterPopover>
            <button type="button" onClick={() => update({ open: !filters.open, selected: null })} aria-pressed={filters.open} className={pillClass(filters.open)}>
              <ClockIcon aria-hidden className="h-4 w-4" />
              {t('filterOpenNow')}
            </button>
          </div>
          <button type="button" onClick={() => setFilterSheetOpen(true)} aria-haspopup="dialog" className={`${pillClass(filterCount - (nearActive ? 1 : 0) > 0)} lg:hidden`}>
            <AdjustmentsHorizontalIcon aria-hidden className="h-4 w-4" />
            {t('filters')}
            {filterCount - (nearActive ? 1 : 0) > 0 && (
              <span className="rounded-full bg-white/25 px-1.5 text-xs">{filterCount - (nearActive ? 1 : 0)}</span>
            )}
          </button>
        </div>

        {locationPanel}
        {!online && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-slate-200/70 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <SignalSlashIcon aria-hidden className="h-4 w-4 shrink-0" />
            {t('offline')}
          </p>
        )}
      </div>

      <MobileFilterSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        categories={categories}
        activeSlugs={activeSlugs}
        allCategoriesActive={allCategoriesActive}
        onToggleCategory={toggleCategory}
        onSelectAllCategories={() => update({ categories: [], selected: null })}
        counties={counties}
        countySlug={filters.county}
        onSelectCounty={(slug) => update({ county: slug, selected: null })}
        openNowOnly={filters.open}
        onToggleOpenNow={() => update({ open: !filters.open, selected: null })}
        priceBucketId={filters.price}
        onSelectPriceBucket={(id) => update({ price: id, selected: null })}
        hasActiveFilters={hasAnything}
        onClear={clearAll}
        resultCount={results.length}
      />

      <div className="relative flex min-h-0 flex-1">
        {isDesktop && (
          <aside aria-label={t('listLabel')} className="flex w-[27rem] shrink-0 flex-col border-e border-[var(--border-subtle)] dark:border-slate-800 xl:w-[30rem]">
            <div className="shrink-0 px-5 pb-2 pt-4">{listHeader}</div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">{list}</div>
          </aside>
        )}

        <div className="relative min-h-0 flex-1">
          <MapContainer center={MONROVIA_CENTER} zoom={LIBERIA_ZOOM} scrollWheelZoom className="h-full w-full" keyboard>
            <TileLayer attribution={BASEMAP_ATTRIBUTION} url={BASEMAP_TILE_URL} />
            <FitResults
              results={results}
              fitKey={fitKey}
              origin={nearActive ? origin : null}
              radiusKm={filters.radiusKm}
              bottomInset={isDesktop ? 0 : sheetHeight}
            />
            <MapFocus request={focus} bottomInset={isDesktop ? 0 : sheetHeight} />
            <TapToSetPoint active={locateStatus === 'picking'} onPick={(coords) => setPoint({ ...coords, source: 'manual' })} />
            {nearActive && origin && (
              <>
                <Circle
                  center={[origin.lat, origin.lng]}
                  radius={filters.radiusKm * 1000}
                  pathOptions={{ color: '#257450', weight: 1.5, fillOpacity: 0.06 }}
                  interactive={false}
                />
                <Marker
                  position={[origin.lat, origin.lng]}
                  icon={originIcon(origin.source)}
                  zIndexOffset={1000}
                  title={origin.source === 'device' ? t('youAreHere') : t('pointYouChose')}
                  keyboard={false}
                />
              </>
            )}
            {results.map(({ place }) => {
              const state = place.id === selectedId ? 'selected' : place.id === hoveredId ? 'hover' : 'idle';
              return (
                <Marker
                  key={place.id}
                  position={[place.latitude, place.longitude]}
                  icon={pinIcon(place, state)}
                  title={place.name}
                  alt={place.name}
                  zIndexOffset={state === 'idle' ? 0 : 500}
                  eventHandlers={{ click: () => selectFromMap(place) }}
                />
              );
            })}
          </MapContainer>

          {locateStatus === 'picking' && (
            <p className="pointer-events-none absolute inset-x-0 top-3 z-[1000] mx-auto w-fit rounded-full bg-slate-950/85 px-4 py-2 text-sm font-semibold text-white shadow-lg">
              {t('tapMapHint')}
            </p>
          )}

          {!isDesktop && (
            <BottomSheet snap={snap} onSnap={setSnap} header={listHeader} onHeightChange={setSheetHeight}>
              {list}
            </BottomSheet>
          )}
        </div>
      </div>
    </div>
  );
}
