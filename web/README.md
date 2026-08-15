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

- **Brand**: `public/logo.png` is the real LIBERIA360 mark, used in the header and as the source for `public/icons/icon-{192,512}.png` (manifest) and `src/app/icon.png` (Next's favicon file convention). It's a full circular lockup (wordmark + tagline), not an icon-only mark, so it reads a little busy at favicon size — a simplified icon-only crop would be a worthwhile follow-up if a designer produces one.
- **Styling**: Tailwind CSS in `tailwind.config.ts`, palette sampled directly from `public/logo.png`: `brand` (navy — the wordmark/capitol/arc, used for nav/links/buttons), `accent` (green — palm/waterfall/the "O", used for imagery placeholders), `gold` and `flag` (the sun and Liberian-flag-red details, used sparingly as accents).
- **PWA**: `public/manifest.webmanifest` + a hand-written `public/sw.js` (app-shell caching, Tech Spec §6.3).
- **API client**: `src/lib/api.ts` wraps `fetch` against `NEXT_PUBLIC_API_URL`. `src/lib/types.ts` mirrors the API's entity shapes by hand; if this grows into a real shared-types package later, that's the file to replace.
- **Map**: `/explore` uses Leaflet + OpenStreetMap raster tiles (free, no API key) so the map works out of the box. Tech Spec §12 leaves Mapbox vs. Google Maps Platform as an open decision for production — swapping the `TileLayer` in `ExploreMapClient.tsx` is the point to revisit that. Category pins are colored via a deterministic hash (`src/lib/category-colors.ts`) so new categories automatically get a distinct color. Note: some sandboxed/offline dev environments block `tile.openstreetmap.org` outbound — the map, filters, and markers still work, just without basemap tiles; this is a network-policy artifact, not an app bug.
