'use client';

import { useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import 'leaflet/dist/leaflet.css';
import type { Category, Place } from '@/lib/types';
import { colorForCategory } from '@/lib/category-colors';

const MONROVIA_CENTER: [number, number] = [6.3106, -10.8047];

function pinIcon(color: string, icon: string | null) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-base shadow-md">${icon ?? '📍'}</div>`,
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {visiblePlaces.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={pinIcon(colorForCategory(place.category.slug), place.category.icon)}
          >
            <Popup>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-slate-900">{place.name}</p>
                <p className="text-xs text-slate-500">{place.category.name}</p>
                <Link href={`/places/${place.slug}`} className="text-sm font-medium text-brand-700 hover:underline">
                  View details →
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
                active ? 'border-transparent text-white' : 'border-slate-300 bg-white/90 text-slate-500'
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
