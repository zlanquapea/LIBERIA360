'use client';

import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import 'leaflet/dist/leaflet.css';
import type { Category, Place } from '@/lib/types';
import { colorForCategory } from '@/lib/category-colors';

const MONROVIA_CENTER: [number, number] = [6.3106, -10.8047];

// Heroicons' MapPinIcon (solid) path, inlined — Leaflet's divIcon renders a
// raw HTML string, not JSX, so a <MapPinIcon /> component can't be used
// directly here the way it is everywhere else in the app.
const MAP_PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="white" class="h-4 w-4"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd"/></svg>';

function pinIcon(color: string, icon: string | null) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-base shadow-md">${icon ?? MAP_PIN_SVG}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export function ExploreMapClient({ places, categories }: { places: Place[]; categories: Category[] }) {
  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set(categories.map((c) => c.slug)));

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
        {visiblePlaces.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={pinIcon(colorForCategory(place.category.slug), place.category.icon)}
          >
            <Popup>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-slate-900 dark:text-slate-50">{place.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{place.category.name}</p>
                <Link
                  href={`/places/${place.slug}`}
                  className="flex items-center gap-0.5 text-sm font-medium text-brand-700 hover:underline"
                >
                  View details
                  <ArrowRightIcon aria-hidden className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex gap-2 overflow-x-auto p-3">
        {categories.map((category) => {
          const active = activeSlugs.has(category.slug);
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategory(category.slug)}
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
  );
}
