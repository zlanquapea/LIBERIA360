'use client';

import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Same plain brand-colored pin PlaceLocationPicker uses while placing a
// location — events have no category→color/icon system the way Places do
// (see PlaceMiniMapClient), so there's nothing to look up here.
const pinIcon = L.divIcon({
  className: '',
  html: '<div class="flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-brand-700 shadow-md"><div class="h-2.5 w-2.5 rounded-full bg-white"></div></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// A non-interactive display-only map for one pinned event location —
// the events counterpart to PlaceMiniMapClient, on the event detail page.
export function EventMiniMapClient({ latitude, longitude }: { latitude: number; longitude: number }) {
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
      <Marker position={[latitude, longitude]} icon={pinIcon} />
    </MapContainer>
  );
}
