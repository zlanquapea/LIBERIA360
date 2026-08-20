# LIBERIA360 Web

Next.js (App Router) frontend — a single responsive codebase for mobile, tablet, and desktop.

## Setup

```bash
cp .env.example .env.local
npm install
```

Requires the API (`../api`) running — see `../api/README.md`.

**Codespaces**: the default `NEXT_PUBLIC_API_URL` only works for server-rendered pages. Client-side requests (auth, form submissions) need it pointed at port 3001's forwarded URL — see the root `README.md`'s Codespaces section.

## Run

```bash
npm run dev     # http://localhost:3000
```

## Tests

```bash
npm run test
npm run test:watch
```

Jest + React Testing Library, via `next/jest`. Covers `lib/*` utility functions, `localStorage`-backed modules (`auth-storage`, `saved-places`), HTTP error normalization, and component rendering.

```bash
npm run test:e2e
```

Playwright, against a real running API + database — see [`e2e/README.md`](./e2e/README.md) for what's covered and how to run it.

## Build

```bash
npm run build
npm run lint
```

## Configuration

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin for SEO structured data |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side crash reporting |

## Architecture

- **Data fetching**: server components fetch directly from the API for public, unauthenticated pages (catalog, counties, search). Authenticated pages and mutations are client components — auth state lives in `localStorage` (`src/lib/auth-storage.ts`), not a cookie, so there is no server session to read from a server component.
- **HTTP layer**: `src/lib/api.ts` (`apiFetch`) handles unauthenticated server-side reads; `src/lib/http.ts` (`apiRequest`) plus per-resource `*-api.ts` modules handle authenticated client-side writes, normalizing API error responses into a single message string.
- **Shared types**: `src/lib/types.ts` re-exports `@liberia360/shared-types`, a local npm workspace package holding the canonical response shapes for every API resource.
- **Styling**: Tailwind CSS (`tailwind.config.ts`); brand palette (`brand`, `accent`, `gold`, `flag`) sourced from the logo.
- **Theme (light/dark)**: class-based (`darkMode: 'class'`), not OS-media-based — a user's explicit choice has to win over `prefers-color-scheme`. `src/lib/theme-storage.ts` holds the state (same localStorage + custom-event pattern as `auth-storage.ts`, no React context); `src/hooks/useTheme.ts` wraps it; `ThemeToggle` (in the header, every page) flips it. An inline blocking script in `layout.tsx`'s `<head>` applies the `dark` class before first paint, so there's no flash of the wrong theme on load. New components should pair light Tailwind classes with a `dark:` variant rather than assume a fixed background — check `content-shared.tsx` or `Header.tsx` for the established slate/brand/amber tint mappings.
- **Maps**: Leaflet + OpenStreetMap tiles (`/explore`), category markers colored via a deterministic hash. Admin > Content > Places' location picker (`admin/content/PlaceLocationPicker.tsx`) replaces raw lat/lng number entry with click/drag-to-place-a-pin on the same Leaflet+OSM setup — no API key needed. Its address/landmark search box is a pure enhancement on top of that, only rendered when `NEXT_PUBLIC_MAPBOX_TOKEN` is set (Mapbox Geocoding API, scoped to Liberia); unset, the picker still works fully by click/drag alone.
- **PWA**: `public/manifest.webmanifest` + `public/sw.js` (app-shell caching, push notification handlers). Saved places are snapshotted to `localStorage` for offline access, independent of the service worker's HTTP cache.
- **SEO**: schema.org JSON-LD on destination and event pages (`src/lib/structured-data.ts`).
- **Crash reporting**: `@sentry/browser` (client-side errors only), no-op unless `NEXT_PUBLIC_SENTRY_DSN` is set.
- **Admin information architecture**: a 7-group collapsible sidebar (`src/lib/admin-nav.ts`) — Dashboard, Analytics, Content, Users & Roles, Settings, Security, System/Operations — driven by a typed capability model (`src/lib/capabilities.ts`) rather than scattered `isAdmin`/`isSuperAdmin` checks. `hasCapability(user, capability)` resolves each capability to a role tier; today that's still just the two real backend tiers (`AdminGuard`/`SuperAdminGuard`), so this is a naming/consistency layer over real enforcement, not a new permissions engine — see `/admin/roles` (Roles & Permissions) for the same map rendered as a reference page. Sections without a real feature behind them yet (Settings, a dynamic Roles editor) render an honest "not built yet" state (`PlaceholderPage` in `admin-ui.tsx`) instead of fake controls. Shared dashboard primitives (`KpiCard` with period-over-period deltas, `Panel`, `EmptyState`, `PeriodToggle`) live in `src/components/admin-ui.tsx`.

## Feature set

| Area | Pages / components |
|---|---|
| Catalog | Home, Explore (map), category/county browse, search, destination profile, saved places |
| Auth | Login, signup, two-factor authentication, forgot/reset password, email verification, account security |
| Content | Reviews, business self-claim and management, creator directory/profiles, events, photo uploads |
| Trip planning | Trip Planner, Weekend Explorer, collaborative multi-user trip editing |
| Marketplace | Booking requests, in-booking messaging, business analytics dashboard, featured placements/creators |
| Admin | Dashboard (KPIs w/ deltas, insights, needs-attention, recent activity), Analytics (overview/user/content/engagement/growth/reports), Content (catalog, moderation, content reports, featured content), Users & Roles (all users, administrators, roles reference, activity), Security (overview, login & auth, sessions & devices, alerts, audit log), Settings (placeholders), System/Operations (live runtime status) |
| Platform | Push notification opt-in, offline saved places, freshness reporting |

Admin pages (`/admin/*`) are gated client-side by `AdminGate`/`SuperAdminGate` for UX; the API's `AdminGuard`/`SuperAdminGuard` are the actual enforcement.

## Known limitations

- `public/logo.png` is a full circular lockup rather than an icon-only mark; it reads busy at favicon size.
- Unit test coverage (Jest) is a baseline — utilities and core components, not exhaustive. The Playwright suite covers the critical end-to-end flows (auth, search, reviews, bookings, admin moderation — see `e2e/README.md`), not every screen.
