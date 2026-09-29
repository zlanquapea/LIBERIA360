'use client';

import { AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_MAP_ID } from '@/lib/google-maps';
import { GoogleMapsProvider } from './GoogleMapsProvider';
import { CENTERED_MARKER_ANCHOR, CategoryMapPin } from './MapMarkerContent';

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
    <GoogleMapsProvider>
      <Map
        mapId={GOOGLE_MAPS_MAP_ID}
        defaultCenter={{ lat: latitude, lng: longitude }}
        defaultZoom={14}
        gestureHandling="none"
        disableDefaultUI
        className="h-full w-full"
      >
        <AdvancedMarker position={{ lat: latitude, lng: longitude }} {...CENTERED_MARKER_ANCHOR}>
          <CategoryMapPin color={color} icon={icon} categorySlug={categorySlug} />
        </AdvancedMarker>
      </Map>
    </GoogleMapsProvider>
  );
}
