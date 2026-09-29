// Central config for every Google Map in the app. NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
// needs the "Maps JavaScript API" enabled (and "Places API" too, for the
// admin location picker's address search) on a Google Cloud project with
// billing enabled — see DEPLOYMENT.md for the full setup walkthrough.
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// Advanced Markers — the custom-styled pins every map in this app uses —
// require a Map ID (Google Cloud Console → Google Maps Platform → Map
// Management → Create Map ID; no additional cost). DEMO_MAP_ID is Google's
// own placeholder for evaluation only: it renders a visible
// "for development purposes only" watermark, so it's a safe default that
// degrades instead of crashing when a real one hasn't been created yet, but
// production should set NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID to a real one.
export const GOOGLE_MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

// Same country bias every map/search in the app uses — Liberia's CLDR
// region code, for Places Autocomplete's `includedRegionCodes`.
export const LIBERIA_REGION_CODE = 'lr';

export const MONROVIA_CENTER: google.maps.LatLngLiteral = { lat: 6.3106, lng: -10.8047 };
