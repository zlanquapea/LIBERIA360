'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L, { type LeafletMouseEvent } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { inputClass } from './content-shared';

const MONROVIA_CENTER: [number, number] = [6.3106, -10.8047];

// Public token (browser-safe by design, same as Mapbox's own client-side
// usage docs — restrict it to your domain in the Mapbox dashboard, don't
// treat it as a secret). Unset by default, same "degrades gracefully"
// pattern as every other optional integration in this app (SMTP, VAPID,
// Sentry) — the click-to-place-a-pin map still works with zero setup;
// only the "search by address/landmark name" box needs this.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const pinIcon = L.divIcon({
  className: '',
  html: '<div class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brand-700 shadow-md"><div class="h-2.5 w-2.5 rounded-full bg-white"></div></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Imperatively re-centers the existing map instance rather than remounting
// <MapContainer> with a new `center` prop — react-leaflet only reads
// `center`/`zoom` once, on mount, so changing them later (e.g. after
// picking a search result) would otherwise do nothing.
function FlyTo({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1]]);
  return null;
}

interface GeocodeResult {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
}

/**
 * Replaces raw "type a decimal into a number box" latitude/longitude entry
 * with an interactive map: click (or drag the pin) to set the exact spot,
 * with visual confirmation instead of trusting a typed number. This is the
 * actual fix for "pins are in the wrong place" — it works with zero setup,
 * no API key. The address-search box above the map is a pure enhancement
 * on top of that (jump-to-a-landmark instead of hunting on the map by eye)
 * and only appears once NEXT_PUBLIC_MAPBOX_TOKEN is configured.
 *
 * Two more ways to set the same lat/lng, for the cases the map itself
 * doesn't cover well: "Use my current location" (`navigator.geolocation`)
 * for a submitter standing at the place right now — the easiest path when
 * that's true, and one that needs no map-reading skill at all — and a
 * manual latitude/longitude entry for anyone who already has the exact
 * coordinates from somewhere else (a GPS device, a shared map pin) and
 * would rather type them than hunt visually. Both just call the same
 * `onChange` the map's click/drag does, so from the caller's side nothing
 * about the value they receive differs by which method produced it.
 */
export function PlaceLocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const position: [number, number] | null = latitude !== null && longitude !== null ? [latitude, longitude] : null;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [latInput, setLatInput] = useState(latitude !== null ? String(latitude) : '');
  const [lngInput, setLngInput] = useState(longitude !== null ? String(longitude) : '');
  const [coordError, setCoordError] = useState<string | null>(null);
  // Briefly highlights the lat/lng boxes + shows a confirmation line right
  // after "Use my current location" succeeds — the values updating on
  // their own is correct but easy to miss; this makes the update visibly
  // happen instead of just quietly being true, which is the whole point
  // of offering the button in the first place (trust that it worked).
  const [justLocated, setJustLocated] = useState(false);
  const justLocatedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (justLocatedTimeout.current) clearTimeout(justLocatedTimeout.current);
    };
  }, []);

  // Keep the manual-entry boxes in sync with whatever last set the
  // position — a map click, a drag, a search result, or "use my current
  // location" — so they never show a stale value the caller didn't
  // actually confirm.
  useEffect(() => {
    setLatInput(latitude !== null ? latitude.toFixed(6) : '');
    setLngInput(longitude !== null ? longitude.toFixed(6) : '');
  }, [latitude, longitude]);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocateError("This browser doesn't support location — enter coordinates manually or use the map instead.");
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onChange(lat, lng);
        setFlyTarget([lat, lng]);
        setLocating(false);
        setJustLocated(true);
        if (justLocatedTimeout.current) clearTimeout(justLocatedTimeout.current);
        justLocatedTimeout.current = setTimeout(() => setJustLocated(false), 2000);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied — enter coordinates manually or use the map instead.'
            : "Couldn't get your location — enter coordinates manually or use the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function commitManualCoords() {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setCoordError('Enter both a latitude and a longitude.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setCoordError('Latitude must be between -90 and 90, longitude between -180 and 180.');
      return;
    }
    setCoordError(null);
    onChange(lat, lng);
    setFlyTarget([lat, lng]);
  }

  async function search() {
    if (!MAPBOX_TOKEN || !query.trim()) return;
    setSearching(true);
    setResults(null);
    try {
      // country=lr (Liberia) + proximity biased to Monrovia — this app
      // never needs a result outside the country, and biasing nearby
      // resolves ambiguous names (there's more than one "Church Street")
      // toward the right one far more often than an unscoped search.
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        country: 'lr',
        proximity: `${MONROVIA_CENTER[1]},${MONROVIA_CENTER[0]}`,
        limit: '5',
      });
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?${params}`,
      );
      const data = (await res.json()) as { features?: MapboxFeature[] };
      setResults(
        (data.features ?? []).map((f) => ({
          id: f.id,
          name: f.place_name,
          lat: f.center[1],
          lng: f.center[0],
        })),
      );
    } catch {
      // A failed geocoding call (network hiccup, rate limit) shouldn't
      // block the actual task — the map itself still works, this is just
      // a shortcut to get there faster.
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function pickResult(result: GeocodeResult) {
    onChange(result.lat, result.lng);
    setFlyTarget([result.lat, result.lng]);
    setResults(null);
    setQuery(result.name);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {MAPBOX_TOKEN && (
          <div className="relative flex-1">
            <div className="flex gap-2">
              <input
                placeholder="Search for an address or landmark…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    search();
                  }
                }}
                className={`flex-1 ${inputClass}`}
              />
              <button
                type="button"
                onClick={search}
                disabled={searching || !query.trim()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
              >
                {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
            {results && results.length > 0 && (
              <ul className="absolute z-[1000] mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => pickResult(result)}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {result.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {results && results.length === 0 && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">No matches found.</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
        >
          <MapPinIcon aria-hidden className="h-4 w-4" />
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
      </div>
      {locateError && <p className="text-xs text-flag-700 dark:text-flag-300">{locateError}</p>}
      {justLocated && (
        <p className="text-xs font-medium text-emerald-700 transition-opacity dark:text-emerald-400">
          📍 Found you — coordinates updated below.
        </p>
      )}

      <div className="h-64 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
        <MapContainer center={position ?? MONROVIA_CENTER} zoom={position ? 14 : 8} className="h-full w-full">
          {/* CARTO's basemap tiles, not raw tile.openstreetmap.org — see
              ExploreMapClient.tsx's comment on why. */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
            subdomains="abcd"
          />
          <ClickToPlace onPick={onChange} />
          {flyTarget && <FlyTo position={flyTarget} />}
          {position && (
            <Marker
              position={position}
              draggable
              icon={pinIcon}
              eventHandlers={{
                dragend: (e) => {
                  const marker = e.target as L.Marker;
                  const { lat, lng } = marker.getLatLng();
                  onChange(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {position ? (
          <>
            {position[0].toFixed(6)}, {position[1].toFixed(6)} — click elsewhere on the map or drag the pin to
            adjust.
          </>
        ) : (
          'Click the map to set this place’s exact location.'
        )}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
          Latitude
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            placeholder="6.310600"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            onBlur={commitManualCoords}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitManualCoords();
              }
            }}
            className={`w-36 ${inputClass} transition-colors duration-700 ${
              justLocated ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900' : ''
            }`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-700 dark:text-slate-200">
          Longitude
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            placeholder="-10.804700"
            value={lngInput}
            onChange={(e) => setLngInput(e.target.value)}
            onBlur={commitManualCoords}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitManualCoords();
              }
            }}
            className={`w-36 ${inputClass} transition-colors duration-700 ${
              justLocated ? 'border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900' : ''
            }`}
          />
        </label>
        <button
          type="button"
          onClick={commitManualCoords}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:text-slate-200"
        >
          Set
        </button>
      </div>
      {coordError && <p className="text-xs text-flag-700 dark:text-flag-300">{coordError}</p>}
    </div>
  );
}
