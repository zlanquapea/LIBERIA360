'use client';

import { AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import { GOOGLE_MAPS_MAP_ID } from '@/lib/google-maps';
import { GoogleMapsProvider } from './GoogleMapsProvider';
import { BrandMapPin, CENTERED_MARKER_ANCHOR } from './MapMarkerContent';

// A non-interactive display-only map for one pinned event location —
// the events counterpart to PlaceMiniMapClient, on the event detail page.
export function EventMiniMapClient({ latitude, longitude }: { latitude: number; longitude: number }) {
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
          <BrandMapPin />
        </AdvancedMarker>
      </Map>
    </GoogleMapsProvider>
  );
}
