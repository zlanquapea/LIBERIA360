// Used by WeekendExplorerForm, which requires a starting point to search
// outward from — TripPlannerForm doesn't use this at all (a trip's stops
// are hand-picked by the traveler, not sequenced from a starting point).
export function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location access was denied. Enable it in your browser settings to use this.';
    case err.POSITION_UNAVAILABLE:
      return "Couldn't determine your location. Please try again.";
    case err.TIMEOUT:
      return 'Finding your location took too long. Please try again.';
    default:
      return 'Something went wrong getting your location.';
  }
}

export type Coords = { lat: number; lng: number };

export function requestGeolocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (err) => reject(new Error(geolocationErrorMessage(err))),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
