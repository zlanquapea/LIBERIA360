'use client';

import { useState } from 'react';
import { AdvancedMarker, InfoWindow, Map, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ItineraryStopDetail } from '@/lib/types';
import { stopCoords } from '@/lib/trip-map';
import { GOOGLE_MAPS_MAP_ID } from '@/lib/google-maps';
import { GoogleMapsProvider } from './GoogleMapsProvider';
import { CENTERED_MARKER_ANCHOR, DayMapPin } from './MapMarkerContent';

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

function dayColor(day: number): string {
  return DAY_COLORS[(day - 1) % DAY_COLORS.length];
}

function stopHref(stop: ItineraryStopDetail): string {
  if (stop.event) return `/events/${stop.event.id}`;
  return `/places/${stop.place!.slug}`;
}

function stopTitle(stop: ItineraryStopDetail): string {
  return stop.event?.name ?? stop.place!.name;
}

// One marker + its own InfoWindow, as its own component — see
// ExploreMapClient's ExplorePlaceMarker for why (an <InfoWindow anchor={...}>
// needs a per-marker ref from useAdvancedMarkerRef, which can't be called
// inside a .map() loop).
function TripStopMarker({
  stop,
  coords,
  selected,
  onSelect,
  onDeselect,
}: {
  stop: ItineraryStopDetail;
  coords: [number, number];
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
}) {
  const t = useTranslations('trips');
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [lat, lng] = coords;

  return (
    <>
      <AdvancedMarker ref={markerRef} position={{ lat, lng }} onClick={onSelect} {...CENTERED_MARKER_ANCHOR}>
        <DayMapPin day={stop.day} color={dayColor(stop.day)} />
      </AdvancedMarker>
      {selected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onDeselect}>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-slate-900 dark:text-slate-50">{stopTitle(stop)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('dayChip', { day: stop.day })}</p>
            <Link href={stopHref(stop)} className="text-sm font-medium text-brand-700 dark:text-brand-300 hover:underline">
              {t('viewDetails')}
            </Link>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// Only place and event stops have real coordinates — CarListing carries no
// latitude/longitude at all (only a county + free-text pickup location),
// so a car-rental stop never gets a pin here. See this component's own
// TripMapLoader for the "nothing to plot" gate.
export function TripMapClient({ stops }: { stops: ItineraryStopDetail[] }) {
  const pins = stops
    .map((stop) => {
      const coords = stopCoords(stop);
      return coords ? { stop, coords } : null;
    })
    .filter((p): p is { stop: ItineraryStopDetail; coords: [number, number] } => p !== null);

  if (pins.length === 0) return null;

  const lats = pins.map((p) => p.coords[0]);
  const lngs = pins.map((p) => p.coords[1]);
  const bounds = {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
    padding: 40,
  };
  // A single stop gives a zero-area bounds box, which some zoom
  // implementations render at max zoom — center on it directly instead.
  const isSinglePoint = pins.length === 1;

  return (
    <GoogleMapsProvider>
      <Map
        mapId={GOOGLE_MAPS_MAP_ID}
        {...(isSinglePoint ? { defaultCenter: { lat: lats[0], lng: lngs[0] }, defaultZoom: 14 } : { defaultBounds: bounds })}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        className="h-full w-full"
      >
        <TripStopMarkers pins={pins} />
      </Map>
    </GoogleMapsProvider>
  );
}

// Split out so the selected-marker state doesn't live on the outer
// component (which has an early `return null` before any pins exist to
// plot) — TripStopMarkers itself is only ever mounted once pins.length > 0,
// so its own hook calls stay consistent across renders.
function TripStopMarkers({ pins }: { pins: { stop: ItineraryStopDetail; coords: [number, number] }[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  return (
    <>
      {pins.map(({ stop, coords }) => {
        const itemId = stop.place?.id ?? stop.event?.id;
        const key = `${stop.day}-${stop.order}-${itemId}`;
        return (
          <TripStopMarker
            key={key}
            stop={stop}
            coords={coords}
            selected={selectedKey === key}
            onSelect={() => setSelectedKey(key)}
            onDeselect={() => setSelectedKey((current) => (current === key ? null : current))}
          />
        );
      })}
    </>
  );
}
