// Straight-line ("as the crow flies") distance between two coordinates, in
// kilometers — the haversine formula. Near Me delegates this to the
// backend (PlacesQuery's lat/lng/radiusKm — see api/src/places/places.service.ts's
// own haversine, which this mirrors) because it needs a fresh page of
// results from the whole catalog; Explore's map already has every place
// loaded client-side, so filtering "within N km of here" is just this
// calculation run locally instead of a round trip.
export type Coordinates = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
