'use client';

import { useEffect, useRef, useState } from 'react';
import { AdvancedMarker, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPinIcon } from '@heroicons/react/24/outline';
import {
  geolocationErrorMessage,
  LOCATING_MESSAGE_INTERVAL_MS,
  LOCATING_MESSAGES,
  LOCATING_PATIENCE_MESSAGE,
  LOCATION_MAX_AGE_MS,
  LOCATION_TIMEOUT_MS,
} from '@/lib/geolocation';
import { GOOGLE_MAPS_MAP_ID, LIBERIA_REGION_CODE, MONROVIA_CENTER } from '@/lib/google-maps';
import { GoogleMapsProvider } from '@/components/GoogleMapsProvider';
import { BrandMapPin, CENTERED_MARKER_ANCHOR } from '@/components/MapMarkerContent';
import { inputClass } from './content-shared';

// Imperatively re-centers the existing map instance rather than remounting
// <Map> with a new `defaultCenter` — that prop, like react-leaflet's
// `center` before it, is only read once on mount, so changing it later
// (e.g. after picking a search result) would otherwise do nothing.
function FlyTo({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const [lat, lng] = position;
    map.panTo({ lat, lng });
    map.setZoom(Math.max(map.getZoom() ?? 0, 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1]]);
  return null;
}

interface GeocodeResult {
  id: string;
  name: string;
  prediction: google.maps.places.PlacePrediction;
}

/**
 * Replaces raw "type a decimal into a number box" latitude/longitude entry
 * with an interactive map: click (or drag the pin) to set the exact spot,
 * with visual confirmation instead of trusting a typed number. This is the
 * actual fix for "pins are in the wrong place." The address-search box
 * above the map is a pure enhancement on top of that (jump-to-a-landmark
 * instead of hunting on the map by eye), backed by the Places API's
 * Autocomplete — the same Google Maps project/key every other map in this
 * app already requires, so it needs no separate opt-in setup of its own.
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
function PlaceLocationPickerInner({
  latitude,
  longitude,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const position: [number, number] | null = latitude !== null && longitude !== null ? [latitude, longitude] : null;
  const placesLib = useMapsLibrary('places');
  // A fresh token per "session" (first keystroke through the fetchFields
  // call for whichever result gets picked) bundles autocomplete + place
  // details into one billed session instead of separate per-call billing —
  // see google.maps.places.AutocompleteSessionToken's own docs. Reset after
  // a pick so the next search starts its own session.
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locatingMessageIndex, setLocatingMessageIndex] = useState(0);
  const [locateError, setLocateError] = useState<string | null>(null);
  // getCurrentPosition has no built-in cancel — this flag lets a stale
  // success/error callback (from a lookup the user gave up on) know to
  // no-op instead of overwriting state after Cancel was clicked.
  const cancelledLocatingRef = useRef(false);
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

  // Same "still working" narration as NearMeClient's own fix — a location
  // fix genuinely can take minutes indoors or with a weak signal, and a
  // button just reading "Locating…" for that long looks frozen.
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
    cancelledLocatingRef.current = false;
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelledLocatingRef.current) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        onChange(lat, lng);
        setFlyTarget([lat, lng]);
        setLocating(false);
        setJustLocated(true);
        if (justLocatedTimeout.current) clearTimeout(justLocatedTimeout.current);
        justLocatedTimeout.current = setTimeout(() => setJustLocated(false), 2000);
      },
      (err) => {
        if (cancelledLocatingRef.current) return;
        setLocating(false);
        setLocateError(`${geolocationErrorMessage(err)} Or enter coordinates manually, or use the map instead.`);
      },
      // High accuracy: worth the extra time here, unlike Near Me's radius
      // search — this is placing an exact pin. The long timeout (was
      // 10s — the reported "fails after 5-10 seconds") is what actually
      // needed fixing: a real fix can take minutes with a weak signal,
      // and 10s was giving up before the browser was done trying.
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: LOCATION_MAX_AGE_MS },
    );
  }

  // Gives up waiting without pretending the lookup itself can be
  // interrupted — the in-flight callback above just gets ignored if it
  // ever resolves. Same pattern as NearMeClient's own Cancel.
  function cancelLocating() {
    cancelledLocatingRef.current = true;
    setLocating(false);
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
    if (!placesLib || !query.trim()) return;
    setSearching(true);
    setResults(null);
    try {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
      }
      // country=lr (Liberia) + a bias toward Monrovia — this app never
      // needs a result outside the country, and biasing nearby resolves
      // ambiguous names (there's more than one "Church Street") toward the
      // right one far more often than an unscoped search.
      const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query.trim(),
        includedRegionCodes: [LIBERIA_REGION_CODE],
        locationBias: MONROVIA_CENTER,
        sessionToken: sessionTokenRef.current,
      });
      setResults(
        suggestions
          .map((suggestion) => suggestion.placePrediction)
          .filter((prediction): prediction is google.maps.places.PlacePrediction => prediction !== null)
          .slice(0, 5)
          .map((prediction) => ({ id: prediction.placeId, name: prediction.text.text, prediction })),
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

  // Only fetches full place details (an extra billed call) for the one
  // result the user actually picks, not every suggestion in the list.
  async function pickResult(result: GeocodeResult) {
    setResults(null);
    setQuery(result.name);
    const place = result.prediction.toPlace();
    await place.fetchFields({ fields: ['location'] });
    // A session concludes once fetchFields is called — start a fresh one
    // for the next search.
    sessionTokenRef.current = null;
    if (!place.location) return;
    const lat = place.location.lat();
    const lng = place.location.lng();
    onChange(lat, lng);
    setFlyTarget([lat, lng]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
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
              disabled={searching || !query.trim() || !placesLib}
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

        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
        >
          <MapPinIcon aria-hidden className="h-4 w-4" />
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
        {locating && (
          <button
            type="button"
            onClick={cancelLocating}
            className="text-sm font-medium text-slate-500 hover:underline dark:text-slate-400"
          >
            Cancel
          </button>
        )}
      </div>
      {locating && (
        <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {locatingMessage}
        </p>
      )}
      {locateError && <p className="text-xs text-flag-700 dark:text-flag-300">{locateError}</p>}
      {justLocated && (
        <p className="text-xs font-medium text-emerald-700 transition-opacity dark:text-emerald-400">
          📍 Found you — coordinates updated below.
        </p>
      )}

      <div className="h-64 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
        <Map
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultCenter={position ? { lat: position[0], lng: position[1] } : MONROVIA_CENTER}
          defaultZoom={position ? 14 : 8}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className="h-full w-full"
          onClick={(e) => {
            if (e.detail.latLng) onChange(e.detail.latLng.lat, e.detail.latLng.lng);
          }}
        >
          {flyTarget && <FlyTo position={flyTarget} />}
          {position && (
            <AdvancedMarker
              position={{ lat: position[0], lng: position[1] }}
              draggable
              onDragEnd={(e) => {
                if (!e.latLng) return;
                onChange(e.latLng.lat(), e.latLng.lng());
              }}
              {...CENTERED_MARKER_ANCHOR}
            >
              <BrandMapPin />
            </AdvancedMarker>
          )}
        </Map>
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

export function PlaceLocationPicker(props: {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <GoogleMapsProvider>
      <PlaceLocationPickerInner {...props} />
    </GoogleMapsProvider>
  );
}
