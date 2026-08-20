'use client';

import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Heroicons' MapPinIcon (solid) path, inlined — Leaflet's divIcon renders a
// raw HTML string, not JSX, so a <MapPinIcon /> component can't be used
// directly here the way it is everywhere else in the app (see the same
// constant in ExploreMapClient.tsx).
const MAP_PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="white" class="h-4 w-4"><path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clip-rule="evenodd"/></svg>';

function pinIcon(color: string, icon: string | null) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-base shadow-md">${icon ?? MAP_PIN_SVG}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function PlaceMiniMapClient({
  latitude,
  longitude,
  color,
  icon,
}: {
  latitude: number;
  longitude: number;
  color: string;
  icon: string | null;
}) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={14}
      scrollWheelZoom={false}
      dragging={false}
      zoomControl={false}
      attributionControl={false}
      className="h-full w-full"
    >
      {/* CARTO's basemap tiles, not raw tile.openstreetmap.org — see
          ExploreMapClient.tsx's comment on why. */}
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" subdomains="abcd" />
      <Marker position={[latitude, longitude]} icon={pinIcon(color, icon)} />
    </MapContainer>
  );
}
