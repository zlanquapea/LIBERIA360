import type { ItineraryStopDetail } from './types';

// Kept in a plain lib file with no Leaflet import — Leaflet touches
// `window` at import time (see TripMapLoader's own comment), so anything
// imported directly into TripDetailClient.tsx (not behind the
// dynamic(..., {ssr:false}) split) must never pull it in transitively.
export function stopCoords(stop: ItineraryStopDetail): [number, number] | null {
  if (stop.place) return [stop.place.latitude, stop.place.longitude];
  if (stop.event && stop.event.latitude != null && stop.event.longitude != null) {
    return [stop.event.latitude, stop.event.longitude];
  }
  return null;
}

// Whether a trip has anything worth putting on a map at all — used by the
// call site to skip mounting TripMapLoader (and its Leaflet chunk) entirely
// rather than rendering a map with zero pins.
export function tripHasMapPins(stops: ItineraryStopDetail[]): boolean {
  return stops.some((stop) => stopCoords(stop) !== null);
}
