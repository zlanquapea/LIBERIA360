'use client';

import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { ArrowRightIcon, MapPinIcon as LocateIcon } from '@heroicons/react/24/outline';
import 'leaflet/dist/leaflet.css';
import type { Category, Place } from '@/lib/types';
import { colorForCategory } from '@/lib/category-colors';
import { formatDistance } from '@/lib/format';
import { resolveImageUrl, resolveThumbUrl } from '@/lib/images';
import { SafeImage } from './SafeImage';

const MONROVIA_CENTER: [number, number] = [6.3106, -10.8047];

// Heroicons' MapPinIcon (solid) path, inlined — Leaflet's divIcon renders a
// raw HTML string, not JSX, so a <MapPinIcon /> component can't be used
// directly here the way it is everywhere else in the app.
const MAP_PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="white" class="h-4 w-4"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd"/></svg>';

function pinIcon(color: string, icon: string | null, selected: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="flex ${selected ? 'h-10 w-10' : 'h-8 w-8'} -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-base shadow-md ${selected ? 'ring-2 ring-offset-1 ring-slate-900' : ''}">${icon ?? MAP_PIN_SVG}</div>`,
    iconSize: selected ? [40, 40] : [32, 32],
    iconAnchor: selected ? [20, 20] : [16, 16],
    popupAnchor: [0, -16],
  });
}

// Leaflet's built-in geolocation ("locate me") — must live inside
// <MapContainer> to reach the map instance via useMap(). Recentering +
// zooming is Leaflet's own map.locate({ setView: true }), not raw
// navigator.geolocation, so permission prompts/accuracy circle/etc. all
// come for free.
function LocateControl() {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useMapEvents({
    locationfound: () => setLocating(false),
    locationerror: () => {
      setLocating(false);
      setError("Couldn't get your location.");
    },
  });

  return (
    <div className="pointer-events-none absolute bottom-32 right-3 z-[1000] flex flex-col items-end gap-1">
      {error && (
        <span className="pointer-events-auto max-w-[10rem] rounded-lg bg-white/95 px-2 py-1 text-right text-xs text-flag-700 shadow dark:bg-slate-800/95 dark:text-flag-300">
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
        aria-label="Locate me"
        title="Locate me"
        className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-md hover:text-brand-700 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:hover:text-brand-300"
      >
        <LocateIcon aria-hidden className="h-5 w-5" />
      </button>
    </div>
  );
}

// Explore (Map) screen (Tech Spec §4.1, §3.1). Product review readout
// (Aug 22, 2026), "maps need a list companion": the map alone was
// low-context — no result count, no way to compare places without tapping
// every pin, no reset, no way to find your own position. All of that lives
// here now: a result count + Clear filters in the top bar, Leaflet's
// native "locate me", and a scrollable list strip along the bottom that
// mirrors exactly what the map shows (selecting either a card or a marker
// highlights both).
export function ExploreMapClient({ places, categories }: { places: Place[]; categories: Category[] }) {
  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set(categories.map((c) => c.slug)));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visiblePlaces = useMemo(
    () => places.filter((place) => activeSlugs.has(place.category.slug)),
    [places, activeSlugs],
  );

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

  const allActive = activeSlugs.size === categories.length;
  function clearFilters() {
    setActiveSlugs(new Set(categories.map((c) => c.slug)));
  }

  return (
    <div className="relative h-full w-full">
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
        <LocateControl />
        {visiblePlaces.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={pinIcon(colorForCategory(place.category.slug), place.category.icon, place.id === selectedId)}
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
                  View details
                  <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3">
        <div className="pointer-events-auto flex w-fit items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur dark:bg-slate-800/90 dark:text-slate-300">
          <span>
            {visiblePlaces.length} place{visiblePlaces.length === 1 ? '' : 's'} shown
          </span>
          {!allActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-semibold text-brand-700 dark:text-brand-300 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((category) => {
            const active = activeSlugs.has(category.slug);
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCategory(category.slug)}
                aria-pressed={active}
                className={`pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur ${
                  active ? 'border-transparent text-white' : 'border-slate-300 dark:border-slate-700 bg-white/90 text-slate-500 dark:text-slate-400'
                }`}
                style={active ? { backgroundColor: colorForCategory(category.slug) } : undefined}
              >
                <span aria-hidden>{category.icon}</span>
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* List companion — the same places the map shows, so a visitor can
          compare without tapping every pin. Selecting a card here or a
          marker on the map drives the same `selectedId`, so either one
          highlights both. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex gap-2 overflow-x-auto p-3">
        {visiblePlaces.length === 0 ? (
          <p className="pointer-events-auto rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-500 shadow dark:bg-slate-800/95 dark:text-slate-400">
            No places match the selected categories.
          </p>
        ) : (
          visiblePlaces.map((place) => {
            const selected = place.id === selectedId;
            return (
              <button
                key={place.id}
                type="button"
                onClick={() => setSelectedId(place.id)}
                className={`pointer-events-auto flex w-44 shrink-0 items-center gap-2 rounded-xl border p-2 text-left shadow-sm backdrop-blur ${
                  selected
                    ? 'border-brand-500 bg-white dark:bg-slate-800'
                    : 'border-transparent bg-white/90 dark:bg-slate-800/90'
                }`}
              >
                <SafeImage
                  src={place.images[0] ? resolveImageUrl(place.images[0]) : null}
                  thumbSrc={place.images[0] ? resolveThumbUrl(place.images[0]) : null}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                  fallback={
                    <div
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                      style={{ backgroundColor: colorForCategory(place.category.slug) }}
                    >
                      {place.category.icon}
                    </div>
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">{place.name}</p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDistance(place.distanceFromMonroviaKm) ?? place.category.name}
                  </p>
                  {selected && (
                    <Link
                      href={`/places/${place.slug}`}
                      className="text-[11px] font-medium text-brand-700 dark:text-brand-300 hover:underline"
                    >
                      View details →
                    </Link>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
