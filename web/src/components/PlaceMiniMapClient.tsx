'use client';

import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function pinIcon(color: string, icon: string | null) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color}" class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-base shadow-md">${icon ?? '📍'}</div>`,
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
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[latitude, longitude]} icon={pinIcon(color, icon)} />
    </MapContainer>
  );
}
