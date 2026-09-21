'use client';

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import 'leaflet/dist/leaflet.css';
import type { ItineraryStopDetail } from '@/lib/types';
import { stopCoords } from '@/lib/trip-map';

// Cycles by day number rather than by stop kind (contrast ExploreMapClient's
// per-category coloring) — the point of this map is "what's near what on
// Day 2," so day is the thing that should jump out visually.
const DAY_COLORS = [
  '#2563eb',
  '#db2777',
  '#16a34a',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#dc2626',
];

function dayPinIcon(day: number) {
  const color = DAY_COLORS[(day - 1) % DAY_COLORS.length];
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md">${day}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

function stopHref(stop: ItineraryStopDetail): string {
  if (stop.event) return `/events/${stop.event.id}`;
  return `/places/${stop.place!.slug}`;
}

function stopTitle(stop: ItineraryStopDetail): string {
  return stop.event?.name ?? stop.place!.name;
}

// Only place and event stops have real coordinates — CarListing carries no
// latitude/longitude at all (only a county + free-text pickup location),
// so a car-rental stop never gets a pin here. See this component's own
// TripMapLoader for the "nothing to plot" gate.
export function TripMapClient({ stops }: { stops: ItineraryStopDetail[] }) {
  const t = useTranslations('trips');
  const pins = stops
    .map((stop) => {
      const coords = stopCoords(stop);
      return coords ? { stop, coords } : null;
    })
    .filter((p): p is { stop: ItineraryStopDetail; coords: [number, number] } => p !== null);

  if (pins.length === 0) return null;

  return (
    <MapContainer
      bounds={pins.map((p) => p.coords)}
      boundsOptions={{ padding: [40, 40], maxZoom: 15 }}
      scrollWheelZoom
      className="h-full w-full"
    >
      {/* Same CARTO basemap tiles as ExploreMapClient — see that
          component's own comment on why not tile.openstreetmap.org
          directly. */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        subdomains="abcd"
      />
      {pins.map(({ stop, coords }) => {
        const itemId = stop.place?.id ?? stop.event?.id;
        return (
          <Marker
            key={`${stop.day}-${stop.order}-${itemId}`}
            position={coords}
            icon={dayPinIcon(stop.day)}
          >
            <Popup>
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-slate-900 dark:text-slate-50">{stopTitle(stop)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('dayChip', { day: stop.day })}</p>
                <Link
                  href={stopHref(stop)}
                  className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline"
                >
                  {t('viewDetails')}
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
