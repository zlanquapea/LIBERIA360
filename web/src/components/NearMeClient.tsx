'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import { ApiError, getPlaces } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import { BrandLoader } from '@/components/BrandLoader';
import { CategoryIcon } from '@/lib/icons';
import type { Category, Place } from '@/lib/types';

const MAX_RADIUS_KM = 200; // QueryPlacesDto's radiusKm ceiling — "anywhere in Liberia"
const RADIUS_PRESETS = [5, 10, 25, 50, MAX_RADIUS_KM] as const;

// A real GPS/network fix can genuinely take anywhere from a couple of
// seconds to several minutes — weak signal, indoors, an older device —
// and the previous 10s timeout was firing "took too long" while the
// browser was still honestly working on it (product feedback: this was
// routinely happening around 30s, well before anything was actually
// wrong). Ten minutes matches what a patient user would try themselves
// before giving up, paired below with LOCATING_MESSAGES so the wait
// reads as "still working" rather than "frozen".
const LOCATION_TIMEOUT_MS = 10 * 60 * 1000;

function radiusLabel(km: number): string {
  return km === MAX_RADIUS_KM ? 'Anywhere in Liberia' : `${km} km`;
}

type Coords = { lat: number; lng: number };

function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location access was denied. Enable it in your browser settings to use Near Me.';
    case err.POSITION_UNAVAILABLE:
      return "Couldn't determine your location. Please try again.";
    case err.TIMEOUT:
      return "We tried for several minutes but couldn't find your location. Please try again, or check that location access is turned on for your device.";
    default:
      return 'Something went wrong getting your location.';
  }
}

// A "finding you" spinner that just sits there for up to ten minutes
// reads as broken, not patient — so it narrates a plausible slice of what
// a location fix actually involves, cycling every few seconds, and
// settles on a steady reassurance once it's genuinely taking a while
// rather than looping the same "almost there" promise forever.
const LOCATING_MESSAGES = [
  'Finding you…',
  "Waking up your device's GPS…",
  'Checking nearby cell towers and Wi-Fi networks…',
  'Triangulating your signal…',
  'Almost there…',
] as const;
const LOCATING_MESSAGE_INTERVAL_MS = 4000;
const LOCATING_PATIENCE_MESSAGE =
  "Still searching — this can take a while with a weak signal. We'll keep trying for a few more minutes.";

// Product feedback (Aug 25, 2026): "when the user selects the distance,
// they should be able to filter for the kinds of place — a user will be
// interested in finding a nearby restaurant, not every place." The API
// already composes `category` with `lat`/`lng`/`radiusKm` as independent
// filters (see PlacesService.findAll), so this is purely a frontend
// feature-completion — no backend changes needed.
//
// Single-select, not multi — "find restaurants near me" is one intent at
// a time, and a chip row (matching the existing radius-preset row right
// above it) is the fewest-taps way to express that on a page whose whole
// point is fast, on-the-go answers.
export function NearMeClient({ categories }: { categories: Category[] }) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locatingMessageIndex, setLocatingMessageIndex] = useState(0);
  const [locationError, setLocationError] = useState<string | null>(null);
  // getCurrentPosition has no built-in cancel — this flag lets a stale
  // success/error callback (from a lookup the user gave up on and
  // cancelled) know to no-op instead of overwriting state.
  const cancelledLocatingRef = useRef(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const selectedCategory = categorySlug ? categories.find((c) => c.slug === categorySlug) : null;

  // Two real, independent reasons "nothing nearby" can happen and neither
  // is a bug: the catalog is still thin in a tester's area (only a
  // handful of places exist anywhere), or the tester's actual GPS
  // location just isn't near Liberia at all (a remote tester testing
  // from wherever they physically are — no radius trick fixes that).
  // Rather than dead-ending on "try a wider radius" when the selected
  // preset comes back empty, silently also check the widest possible
  // radius so we can either show what's genuinely closest in the whole
  // country, or — if that's empty too — say so plainly instead of
  // suggesting a retry that can't help. The fallback check keeps the same
  // category filter applied — widening the radius should never silently
  // widen *what kind* of place is shown too.
  const [fallbackPlaces, setFallbackPlaces] = useState<Place[] | null>(null);
  const [loadingFallback, setLoadingFallback] = useState(false);

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }
    cancelledLocatingRef.current = false;
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelledLocatingRef.current) return;
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (err) => {
        if (cancelledLocatingRef.current) return;
        setLocationError(geolocationErrorMessage(err));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: 60_000 },
    );
  }, []);

  // Gives up waiting without pretending the lookup itself can be
  // interrupted — the in-flight callback above just gets ignored if it
  // ever resolves.
  function cancelLocating() {
    cancelledLocatingRef.current = true;
    setLocating(false);
  }

  useEffect(() => {
    if (!locating) {
      setLocatingMessageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLocatingMessageIndex((i) => Math.min(i + 1, LOCATING_MESSAGES.length));
    }, LOCATING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [locating]);

  const locatingMessage =
    locatingMessageIndex < LOCATING_MESSAGES.length ? LOCATING_MESSAGES[locatingMessageIndex] : LOCATING_PATIENCE_MESSAGE;

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setLoadingPlaces(true);
    setPlacesError(null);
    setFallbackPlaces(null);
    getPlaces({ lat: coords.lat, lng: coords.lng, radiusKm, category: categorySlug ?? undefined, limit: 30 })
      .then((result) => {
        if (cancelled) return;
        setPlaces(result.data);
        if (result.data.length === 0 && radiusKm !== MAX_RADIUS_KM) {
          setLoadingFallback(true);
          getPlaces({
            lat: coords.lat,
            lng: coords.lng,
            radiusKm: MAX_RADIUS_KM,
            category: categorySlug ?? undefined,
            limit: 30,
          })
            .then((fallbackResult) => {
              if (!cancelled) setFallbackPlaces(fallbackResult.data);
            })
            .catch(() => {
              // Fail open to the plain "try a wider radius" copy rather
              // than getting stuck on a permanent loading state.
              if (!cancelled) setFallbackPlaces([]);
            })
            .finally(() => {
              if (!cancelled) setLoadingFallback(false);
            });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPlacesError(err instanceof ApiError ? err.message : 'Something went wrong loading nearby places.');
      })
      .finally(() => {
        if (!cancelled) setLoadingPlaces(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coords, radiusKm, categorySlug]);

  const isMaxRadius = radiusKm === MAX_RADIUS_KM;
  const checkingFallback = !loadingPlaces && places.length === 0 && !isMaxRadius && fallbackPlaces === null;
  const showingFallback = !checkingFallback && places.length === 0 && !isMaxRadius && (fallbackPlaces?.length ?? 0) > 0;
  const displayPlaces = showingFallback ? fallbackPlaces! : places;
  // Reached once we've either searched the max radius directly, or
  // silently confirmed it's empty via the fallback check above — at that
  // point "try a wider radius" would be a lie, so the copy changes.
  const confirmedCatalogEmpty = displayPlaces.length === 0 && !checkingFallback && (isMaxRadius || fallbackPlaces?.length === 0);
  const categoryLabel = selectedCategory?.name.toLowerCase() ?? 'places';

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Near Me</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Find places close to where you are right now.</p>
      </div>

      {!coords ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-10 text-center">
          {locating ? (
            <>
              <BrandLoader label={locatingMessage} />
              <p className="max-w-sm text-sm font-medium text-slate-600 dark:text-slate-300" aria-live="polite">
                {locatingMessage}
              </p>
              <button
                type="button"
                onClick={cancelLocating}
                className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <ViewfinderCircleIcon aria-hidden className="h-10 w-10 text-gold-500" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Share your location to see what&apos;s nearby.</p>
              <button
                type="button"
                onClick={requestLocation}
                className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Use my location
              </button>
            </>
          )}
          {locationError && (
            <p role="alert" className="max-w-sm text-sm text-flag-700 dark:text-flag-300">
              {locationError}
            </p>
          )}
          <Link href="/explore" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
            Or browse all places instead
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Within</span>
            {RADIUS_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setRadiusKm(preset)}
                aria-pressed={radiusKm === preset}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                  radiusKm === preset
                    ? 'border-transparent bg-brand-700 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
                }`}
              >
                {radiusLabel(preset)}
              </button>
            ))}
            <button
              type="button"
              onClick={requestLocation}
              disabled={locating}
              className="ml-auto text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline disabled:opacity-60"
            >
              {locating ? 'Updating…' : 'Update my location'}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-slate-500 dark:text-slate-400">Looking for</span>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <button
                type="button"
                onClick={() => setCategorySlug(null)}
                aria-pressed={categorySlug === null}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  categorySlug === null
                    ? 'border-transparent bg-brand-700 text-white'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
                }`}
              >
                Everything
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategorySlug(category.slug)}
                  aria-pressed={categorySlug === category.slug}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                    categorySlug === category.slug
                      ? 'border-transparent bg-brand-700 text-white'
                      : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-500'
                  }`}
                >
                  <CategoryIcon iconKey={category.icon} categorySlug={category.slug} className="h-4 w-4" />
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {placesError && (
            <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700 dark:text-flag-300">
              {placesError}
            </p>
          )}

          {loadingPlaces || checkingFallback ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : displayPlaces.length > 0 ? (
            <>
              {showingFallback && (
                <p className="rounded-lg bg-brand-700/5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                  No {categoryLabel} within {radiusKm} km — here&apos;s what&apos;s closest in Liberia.
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {displayPlaces.map((place) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    distanceOverride={place.distanceKm != null ? `${place.distanceKm} km away` : null}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
              <p>
                {confirmedCatalogEmpty
                  ? isMaxRadius
                    ? `We don't have any approved ${categoryLabel} in our catalog yet — check back soon.`
                    : `Nothing within ${radiusKm} km — and we don't have any approved ${categoryLabel} anywhere in Liberia yet. Check back soon.`
                  : `No ${categoryLabel} within ${radiusKm} km yet — try a wider radius${selectedCategory ? ' or a different category' : ''}.`}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setCategorySlug(null)}
                    className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
                  >
                    Show everything nearby
                  </button>
                )}
                <Link href="/explore" className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
                  Browse all places
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
