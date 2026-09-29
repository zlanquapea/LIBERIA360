// Shared basemap tile source for every Leaflet map in the app.
//
// CARTO's free "rastertiles/voyager" basemap (used here until Sep 2026)
// started rendering "API KEY REQUIRED" watermark tiles in production —
// CARTO tightened its free tier to require a registered API key even for
// this raster endpoint. Esri's World Street Map tile service is the
// replacement: no API key, no billing account, and (unlike
// tile.openstreetmap.org) explicitly meant to serve production traffic —
// see https://server.arcgisonline.com and leaflet-providers.js's own
// "Esri.WorldStreetMap" entry, which countless production Leaflet apps
// already rely on the same way.
export const BASEMAP_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

export const BASEMAP_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom';
