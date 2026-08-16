# LIBERIA360 Web

Next.js (App Router) responsive PWA — the client described in Tech Spec §6.1. One codebase for mobile, tablet, and desktop.

## Setup

```bash
cp .env.example .env.local   # points at the local API by default
npm install                   # (or from repo root — this is an npm workspace)
```

Requires the API (`../api`) running locally for data — see `../api/README.md`.

**Codespaces**: `NEXT_PUBLIC_API_URL`'s default (`http://localhost:3001/api/v1`) only works for Phase 1's server-fetched pages. Phase 2's client-side auth/writes need it pointed at port 3001's *forwarded* URL instead — see the root `README.md`'s "Codespaces: one more step" section before testing signup/login or anything else Phase 2.

## Run

```bash
npm run dev     # http://localhost:3000
```

## Phase 2

Accounts and everything that depends on them (Tech Spec §3.2), all backed by the API modules documented in `../api/README.md`:

- **Auth** (`/login`, `/signup`, `/account`): the JWT + user profile live in `localStorage` (`src/lib/auth-storage.ts`), not a cookie — there's no server session, so every Phase 2 page that needs "am I logged in" is a **client component** (`'use client'`) reading `useAuth()`, not a server component. This is why pages like `/trips`, `/trips/[id]`, and `/creators/me` fetch their data client-side instead of in an `async` server component the way Phase 1's catalog pages do.
- **Two-factor authentication**: `/login` becomes two steps when the account has 2FA on — `useAuth().login()` returns a `{twoFactorRequired, pendingToken}` shape instead of storing a session, and nothing is written to `localStorage` until a second screen collects a 6-digit authenticator code (or a recovery code) and exchanges it via `verifyTwoFactor()`. `TwoFactorSettings` on `/account` handles setup (QR code + manual secret, then a confirm code), the one-time recovery-code reveal, and turning it off (password-confirmed). Its child steps take `setupTwoFactor`/`enableTwoFactor`/`disableTwoFactor` as *props* from the parent's already-hydrated `useAuth()` call rather than calling the hook themselves — `useAuth()` re-reads `localStorage` in its own mount-time effect, so a freshly-mounted child firing an API call from its own effect can race ahead of its own token loading even though the parent's was already ready.
- **Reviews** (`ReviewsSection` on the Destination Profile): star rating + comment form for logged-in users who haven't reviewed that place yet.
- **Business claims** (`BusinessClaimSection` on the Destination Profile): claim form for an unclaimed listing, or a public contact card once claimed.
- **Creators** (`/creators`, `/creators/[username]`, `/creators/me`): directory, public profile, self-service create/edit.
- **Events** (`/events`, `/events/[id]`, `/events/new`): filterable listing, detail, post-an-event form. `NewEventForm` checks eligibility (a claimed business, a creator profile, or admin — mirroring the API's restriction) before showing the form, so a plain traveler sees a clear "claim a business or set up a creator profile" message instead of filling the whole thing out and hitting a 403 at the end.
- **Near Me** (`/near-me`) and **Weekend Explorer** (`/trips/weekend/new`): both use `navigator.geolocation` — client-only, secure-context-only (works on `localhost` in dev; needs real HTTPS in production). Friendly per-error-code messages for denied/unavailable/timeout permission states.
- **Trip Planner** (`/trips`, `/trips/new`, `/trips/[id]`): "Build My Liberia Trip" intake form; results and Weekend Explorer's results share the same detail page and `ItineraryStops` component, since both produce the same resolved-stops shape.
- **Push notification opt-in** (toggle on `/account`): needs `public/sw.js`'s `push`/`notificationclick` handlers plus a VAPID keypair configured on the API (see `../api/README.md`) — silently renders nothing if either isn't available. `navigator.serviceWorker`'s `pushManager.subscribe()` has no built-in timeout, so `src/lib/push-browser.ts` wraps it in a 15s one; without that, a blocked/slow network path (corporate proxy, ad-blocker, etc.) leaves the toggle stuck on its busy state forever.
- **Shared HTTP helpers**: `src/lib/http.ts` (`apiRequest`/`authHeader`/`HttpError`) is what every authenticated *mutation* (`*-api.ts` files — `auth-api`, `reviews-api`, `business-api`, `creator-api`, `event-api`, `itinerary-api`, `push-api`) goes through, normalizing class-validator's `message: string[]` vs. Nest's plain-string exception messages into one readable line. Reads that don't need auth still go through `lib/api.ts`'s server-fetch `apiFetch` (Phase 1's pattern) — including a fix worth knowing about: a Nest controller returning `null` (e.g. `GET /businesses?placeId=...` for an unclaimed place) serializes to a 200 with an *empty* body, not the text `"null"`; `apiFetch` reads the body as text first and treats empty as `null` rather than calling `res.json()` directly, which would throw.

## Phase 3

The marketplace layer (Tech Spec §3.3 / Business Plan §8), all backed by the API modules documented in `../api/README.md`'s "Phase 3" section:

- **Booking request UI**: `BookingRequestSection` on the Destination Profile — shown under a claimed listing's contact card (hidden entirely for an unclaimed one, since there's no one to send the request to; swapped for a "manage this listing" pointer when the viewer is the business owner). `/account/bookings` ("My Bookings") is one page serving both sides at once — a business owner isn't a distinct "role" in this data model, so it lists the signed-in user's own requests (with cancel while pending/confirmed) *and*, for each business they own, an incoming-requests queue with inline confirm/decline. No real payment UI — a request just gets confirmed or declined, per the API's request-to-book-only scope.
- **Business analytics dashboard**: `PlaceViewTracker` fires a `view` event once per Destination Profile load; `SaveButton` fires `save` on a new save (not unsave); `ContactLink` wraps every Call/WhatsApp/Website link (on both the place's own Contact section and the claimed-business card) and fires `contact_click`; `BookingRequestSection` fires `booking_request` on a successful request. `/account/analytics` ("Business Analytics") shows the resulting totals as stat cards plus a 30-day bar chart (plain CSS bars, no charting library) per business the signed-in user owns.
- **"Featured this week" + featured creators**: a horizontally-scrolling row on the home page, built from `GET /sponsored-placements/active` — distinct from the pre-existing "Trending places" section below it (Phase 1's editorial `Place.featured` curation). The creator directory and creator profile page give a `featured` creator a gold badge; no extra sorting logic needed client-side, since the API already orders featured creators first.
- **Admin dashboard** (`/admin`, `/admin/content`, `/admin/sponsored-placements`, `/admin/analytics`): gated by `AdminGate` (`src/components/AdminGate.tsx`), a client-side UX nicety — the real enforcement is the API's `AdminGuard`, which 403s regardless of what this component renders. Covers the moderation queue (verify a pending business, browse recent reviews), a feature/unfeature-a-creator lookup, place/activity/business/event content management (business and activity management is scoped through the place they belong to — there's no flat list-all-businesses endpoint), sponsored-placement create/revoke, and the B2B aggregate analytics view. Linked from `/account` only when `user.isAdmin` is true; see `../api/README.md`'s "Phase 3" section for how to grant that.
- **A caching quirk worth knowing about**: the Destination Profile's server-side business lookup is cached for 60s (`lib/api.ts`'s `next: { revalidate: 60 }`, same as every other Phase 1/2 server fetch) with stale-while-revalidate semantics — a listing claimed (or booking-request-enabled) moments ago can take up to *two* page loads for a different visitor to see, since the first load past the 60s mark can still serve the stale snapshot while kicking off a background refetch. Not a Phase 3 regression (the same mechanism already applied to Phase 2's business-claim data), just easy to trip over when testing "claim, then immediately view as someone else."

## Notes

- **Brand**: `public/logo.png` is the real LIBERIA360 mark, used in the header and as the source for `public/icons/icon-{192,512}.png` (manifest) and `src/app/icon.png` (Next's favicon file convention). It's a full circular lockup (wordmark + tagline), not an icon-only mark, so it reads a little busy at favicon size — a simplified icon-only crop would be a worthwhile follow-up if a designer produces one.
- **Styling**: Tailwind CSS in `tailwind.config.ts`, palette sampled directly from `public/logo.png`: `brand` (navy — the wordmark/capitol/arc, used for nav/links/buttons), `accent` (green — palm/waterfall/the "O", used for imagery placeholders), `gold` and `flag` (the sun and Liberian-flag-red details, used sparingly as accents).
- **PWA**: `public/manifest.webmanifest` + a hand-written `public/sw.js` (app-shell caching, Tech Spec §6.3, plus Phase 2's push notification handlers).
- **API client**: `src/lib/api.ts` wraps `fetch` against `NEXT_PUBLIC_API_URL` for reads; `src/lib/http.ts` + the `*-api.ts` files (above) cover authenticated writes. `src/lib/types.ts` mirrors the API's entity shapes by hand; if this grows into a real shared-types package later, that's the file to replace.
- **Map**: `/explore` uses Leaflet + OpenStreetMap raster tiles (free, no API key) so the map works out of the box. Tech Spec §12 leaves Mapbox vs. Google Maps Platform as an open decision for production — swapping the `TileLayer` in `ExploreMapClient.tsx` is the point to revisit that. Category pins are colored via a deterministic hash (`src/lib/category-colors.ts`) so new categories automatically get a distinct color. Note: some sandboxed/offline dev environments block `tile.openstreetmap.org` outbound — the map, filters, and markers still work, just without basemap tiles; this is a network-policy artifact, not an app bug.
