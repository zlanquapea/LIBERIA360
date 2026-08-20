'use client';

import { useCallback, useEffect, useState } from 'react';
import { ViewfinderCircleIcon } from '@heroicons/react/24/outline';
import { ApiError, getPlaces } from '@/lib/api';
import { PlaceCard } from '@/components/PlaceCard';
import type { Place } from '@/lib/types';

const RADIUS_PRESETS = [5, 10, 25, 50] as const;

type Coords = { lat: number; lng: number };

function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location access was denied. Enable it in your browser settings to use Near Me.';
    case err.POSITION_UNAVAILABLE:
      return "Couldn't determine your location. Please try again.";
    case err.TIMEOUT:
      return 'Finding your location took too long. Please try again.';
    default:
      return 'Something went wrong getting your location.';
  }
}

// Near Me (Tech Spec §3.2) — browser geolocation + radius-filtered
// GET /places?lat&lng&radiusKm. Client-only (navigator.geolocation has no
// server-side equivalent), so this page fetches directly rather than
// through a server component.
export default function NearMePage() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocationError(geolocationErrorMessage(err));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    setLoadingPlaces(true);
    setPlacesError(null);
    getPlaces({ lat: coords.lat, lng: coords.lng, radiusKm, limit: 30 })
      .then((result) => {
        if (!cancelled) setPlaces(result.data);
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
  }, [coords, radiusKm]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Near Me</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Find places close to where you are right now.</p>
      </div>

      {!coords ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-10 text-center">
          <ViewfinderCircleIcon aria-hidden className="h-10 w-10 text-gold-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Share your location to see what&apos;s nearby.</p>
          <button
            type="button"
            onClick={requestLocation}
            disabled={locating}
            className="rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {locating ? 'Finding you…' : 'Use my location'}
          </button>
          {locationError && (
            <p role="alert" className="max-w-sm text-sm text-flag-700">
              {locationError}
            </p>
          )}
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
                {preset} km
              </button>
            ))}
            <button
              type="button"
              onClick={requestLocation}
              disabled={locating}
              className="ml-auto text-sm font-medium text-brand-700 hover:underline disabled:opacity-60"
            >
              {locating ? 'Updating…' : 'Update my location'}
            </button>
          </div>

          {placesError && (
            <p role="alert" className="rounded-lg bg-flag-500/10 px-3 py-2 text-sm text-flag-700">
              {placesError}
            </p>
          )}

          {loadingPlaces ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : places.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-slate-500 dark:text-slate-400">
              Nothing within {radiusKm} km yet — try a wider radius.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {places.map((place) => (
                <PlaceCard
                  key={place.id}
                  place={place}
                  distanceOverride={place.distanceKm != null ? `${place.distanceKm} km away` : null}
                />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
