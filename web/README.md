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

## Phase 2

Accounts and everything that depends on them (Tech Spec §3.2), all backed by the API modules documented in `../api/README.md`:

- **Auth** (`/login`, `/signup`, `/account`): the JWT + user profile live in `localStorage` (`src/lib/auth-storage.ts`), not a cookie — there's no server session, so every Phase 2 page that needs "am I logged in" is a **client component** (`'use client'`) reading `useAuth()`, not a server component. This is why pages like `/trips`, `/trips/[id]`, and `/creators/me` fetch their data client-side instead of in an `async` server component the way Phase 1's catalog pages do.
- **Reviews** (`ReviewsSection` on the Destination Profile): star rating + comment form for logged-in users who haven't reviewed that place yet.
- **Business claims** (`BusinessClaimSection` on the Destination Profile): claim form for an unclaimed listing, or a public contact card once claimed.
- **Creators** (`/creators`, `/creators/[username]`, `/creators/me`): directory, public profile, self-service create/edit.
- **Events** (`/events`, `/events/[id]`, `/events/new`): filterable listing, detail, post-an-event form.
- **Near Me** (`/near-me`) and **Weekend Explorer** (`/trips/weekend/new`): both use `navigator.geolocation` — client-only, secure-context-only (works on `localhost` in dev; needs real HTTPS in production). Friendly per-error-code messages for denied/unavailable/timeout permission states.
- **Trip Planner** (`/trips`, `/trips/new`, `/trips/[id]`): "Build My Liberia Trip" intake form; results and Weekend Explorer's results share the same detail page and `ItineraryStops` component, since both produce the same resolved-stops shape.
- **Push notification opt-in** (toggle on `/account`): needs `public/sw.js`'s `push`/`notificationclick` handlers plus a VAPID keypair configured on the API (see `../api/README.md`) — silently renders nothing if either isn't available. `navigator.serviceWorker`'s `pushManager.subscribe()` has no built-in timeout, so `src/lib/push-browser.ts` wraps it in a 15s one; without that, a blocked/slow network path (corporate proxy, ad-blocker, etc.) leaves the toggle stuck on its busy state forever.
- **Shared HTTP helpers**: `src/lib/http.ts` (`apiRequest`/`authHeader`/`HttpError`) is what every authenticated *mutation* (`*-api.ts` files — `auth-api`, `reviews-api`, `business-api`, `creator-api`, `event-api`, `itinerary-api`, `push-api`) goes through, normalizing class-validator's `message: string[]` vs. Nest's plain-string exception messages into one readable line. Reads that don't need auth still go through `lib/api.ts`'s server-fetch `apiFetch` (Phase 1's pattern) — including a fix worth knowing about: a Nest controller returning `null` (e.g. `GET /businesses?placeId=...` for an unclaimed place) serializes to a 200 with an *empty* body, not the text `"null"`; `apiFetch` reads the body as text first and treats empty as `null` rather than calling `res.json()` directly, which would throw.

## Notes

- **Brand**: `public/logo.png` is the real LIBERIA360 mark, used in the header and as the source for `public/icons/icon-{192,512}.png` (manifest) and `src/app/icon.png` (Next's favicon file convention). It's a full circular lockup (wordmark + tagline), not an icon-only mark, so it reads a little busy at favicon size — a simplified icon-only crop would be a worthwhile follow-up if a designer produces one.
- **Styling**: Tailwind CSS in `tailwind.config.ts`, palette sampled directly from `public/logo.png`: `brand` (navy — the wordmark/capitol/arc, used for nav/links/buttons), `accent` (green — palm/waterfall/the "O", used for imagery placeholders), `gold` and `flag` (the sun and Liberian-flag-red details, used sparingly as accents).
- **PWA**: `public/manifest.webmanifest` + a hand-written `public/sw.js` (app-shell caching, Tech Spec §6.3, plus Phase 2's push notification handlers).
- **API client**: `src/lib/api.ts` wraps `fetch` against `NEXT_PUBLIC_API_URL` for reads; `src/lib/http.ts` + the `*-api.ts` files (above) cover authenticated writes. `src/lib/types.ts` mirrors the API's entity shapes by hand; if this grows into a real shared-types package later, that's the file to replace.
- **Map**: `/explore` uses Leaflet + OpenStreetMap raster tiles (free, no API key) so the map works out of the box. Tech Spec §12 leaves Mapbox vs. Google Maps Platform as an open decision for production — swapping the `TileLayer` in `ExploreMapClient.tsx` is the point to revisit that. Category pins are colored via a deterministic hash (`src/lib/category-colors.ts`) so new categories automatically get a distinct color. Note: some sandboxed/offline dev environments block `tile.openstreetmap.org` outbound — the map, filters, and markers still work, just without basemap tiles; this is a network-policy artifact, not an app bug.
