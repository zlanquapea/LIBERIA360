'use client';

import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { iconSvgMarkup } from '@/lib/icons';
import { BASEMAP_TILE_URL } from '@/lib/map-tiles';

function pinIcon(color: string, icon: string | null, categorySlug: string) {
  return L.divIcon({
    className: '',
    // Leaflet's divIcon renders a raw HTML string, not JSX, so the
    // category's icon has to be serialized to markup up front — see
    // iconSvgMarkup's doc comment (same pattern in ExploreMapClient.tsx).
    html: `<div style="background:${color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-md">${iconSvgMarkup(icon, 'h-4 w-4 text-white', categorySlug)}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function PlaceMiniMapClient({
  latitude,
  longitude,
  color,
  icon,
  categorySlug,
}: {
  latitude: number;
  longitude: number;
  color: string;
  icon: string | null;
  categorySlug: string;
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
      {/* See lib/map-tiles.ts for why this is Esri's tiles, not CARTO's. */}
      <TileLayer url={BASEMAP_TILE_URL} />
      <Marker position={[latitude, longitude]} icon={pinIcon(color, icon, categorySlug)} />
    </MapContainer>
  );
}
