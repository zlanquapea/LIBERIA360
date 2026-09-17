// Shared tuning for every `navigator.geolocation.getCurrentPosition` (or
// Leaflet `map.locate()`, which wraps the same browser API) call in the
// app. Extracted from NearMeClient's own fix (Sep 2026 product feedback:
// "use my location" was routinely failing around 10s while the browser
// was still honestly working on the fix — a real GPS/network lookup can
// take anywhere from a couple of seconds to several minutes indoors or
// with a weak signal) so every other "use my current location" entry
// point — the place/event location picker, the Explore map's locate
// button — gets the same long timeout instead of each guessing its own
// short one and hitting the identical failure mode.
export const LOCATION_TIMEOUT_MS = 10 * 60 * 1000;

// A cached fix up to a minute old is still "here" for anything in this
// app (a radius search, placing a map pin) — reusing one avoids an
// unnecessary fresh GPS/network round trip when the browser already has
// a recent position on hand.
export const LOCATION_MAX_AGE_MS = 60_000;

// A "finding you" spinner that just sits there for up to ten minutes
// reads as broken, not patient — so it narrates a plausible slice of what
// a location fix actually involves, cycling every few seconds, and
// settles on a steady reassurance once it's genuinely taking a while
// rather than looping the same "almost there" promise forever.
export const LOCATING_MESSAGES = [
  'Finding you…',
  "Waking up your device's GPS…",
  'Checking nearby cell towers and Wi-Fi networks…',
  'Triangulating your signal…',
  'Almost there…',
] as const;
export const LOCATING_MESSAGE_INTERVAL_MS = 4000;
export const LOCATING_PATIENCE_MESSAGE =
  "Still searching — this can take a while with a weak signal. We'll keep trying for a few more minutes.";

export function geolocationErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location access was denied. Enable it in your browser settings to use this feature.';
    case err.POSITION_UNAVAILABLE:
      return "Couldn't determine your location. Please try again.";
    case err.TIMEOUT:
      return "We tried for several minutes but couldn't find your location. Please try again, or check that location access is turned on for your device.";
    default:
      return 'Something went wrong getting your location.';
  }
}
