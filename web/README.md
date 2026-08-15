# LIBERIA360 Web

Next.js (App Router) responsive PWA — the client described in Tech Spec §6.1. One codebase for mobile, tablet, and desktop.

## Setup

```bash
cp .env.example .env.local   # points at the local API by default
npm install                   # (or from repo root — this is an npm workspace)
```

Requires the API (`../api`) running locally for data — see `../api/README.md`.

## Run

```bash
npm run dev     # http://localhost:3000
```

## Notes

- **PWA**: `public/manifest.webmanifest` + a hand-written `public/sw.js` (app-shell caching, Tech Spec §6.3). The manifest icon (`public/icon.svg`) is a placeholder — swap for real brand icons (including proper maskable-safe-zone PNGs for Android/iOS) before launch.
- **Styling**: Tailwind CSS with a placeholder brand palette in `tailwind.config.ts` — swap once real brand colors are set.
- **API client**: `src/lib/api.ts` wraps `fetch` against `NEXT_PUBLIC_API_URL`. `src/lib/types.ts` mirrors the API's entity shapes by hand; if this grows into a real shared-types package later, that's the file to replace.
- **Map**: `/explore` uses Leaflet + OpenStreetMap raster tiles (free, no API key) so the map works out of the box. Tech Spec §12 leaves Mapbox vs. Google Maps Platform as an open decision for production — swapping the `TileLayer` in `ExploreMapClient.tsx` is the point to revisit that. Category pins are colored via a deterministic hash (`src/lib/category-colors.ts`) so new categories automatically get a distinct color. Note: some sandboxed/offline dev environments block `tile.openstreetmap.org` outbound — the map, filters, and markers still work, just without basemap tiles; this is a network-policy artifact, not an app bug.
