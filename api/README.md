# LIBERIA360 API

NestJS REST API for the LIBERIA360 Phase 1 discovery MVP (see `../LIBERIA360_Technical_Specification.docx` §6, §10).

## Setup

```bash
cp .env.example .env      # adjust DB credentials if needed
npm install                # (or `npm install` from repo root — this is an npm workspace)
```

Requires a running PostgreSQL instance matching `.env`. Locally:

```bash
sudo -u postgres createuser liberia360 --pwprompt   # password: liberia360 (or match your .env)
sudo -u postgres createdb liberia360 -O liberia360
```

## Run

```bash
npm run start:dev     # http://localhost:3001, watch mode
```

`GET /health` confirms the service is up (unprefixed). All feature endpoints are under `/api/v1/...`.

## Database

- ORM: TypeORM. Schema changes are managed via migrations, not `synchronize` (kept off outside local bootstrapping).
- `npm run migration:run` — apply migrations
- `npm run migration:generate -- src/database/migrations/<Name>` — generate a migration from entity changes
- `npm run seed` — load Stage 1 (Greater Monrovia) sample data

## Tests

```bash
npm run test        # unit tests (services/controllers, DTO validation) — no DB needed
npm run test:e2e     # full HTTP-level tests against a real Postgres DB
```

`test:e2e` needs a `liberia360_test` Postgres database (same user/password as dev). It runs
migrations and truncates/reseeds its own fixtures on every run, so it's safe to re-run and
doesn't touch the dev database:

```bash
createdb -O liberia360 liberia360_test   # one-time setup
```

## Phase 2

Accounts and everything that depends on them (Tech Spec §3.2). All 8 modules below are migrated, unit/e2e tested (`test/phase2.e2e-spec.ts`), and have a matching frontend in `../web`.

- **Auth**: JWT (email/password only — see `src/users/entities/user.enums.ts` for why Google/Apple/phone are schema-ready but not implemented). Set a real `JWT_SECRET` outside local dev. `POST /auth/register`, `POST /auth/login`, `GET /auth/me`.
- **Uploads**: `POST /api/v1/uploads/image` stores to a local `uploads/` folder — dev/demo only, see `src/uploads/uploads.controller.ts` for why this isn't production-ready.
- **Reviews**: `POST /reviews`, `GET /reviews?placeId=...` — one review per user per place; `Place.rating`/`reviewCount` are recomputed from the reviews table on every write, not incrementally maintained. `Review.verifiedVisit` is set automatically at creation time when the reviewer has a `CONFIRMED` booking with a business linked to that place (`ReviewsService.hasConfirmedBooking`) — same loose "verified" semantics as Amazon's Verified Purchase or Booking.com's Verified stay: an extra trust signal, not a gate on who can review (most of the catalog has no bookable business behind it at all, and reviewing stays open regardless).
- **Businesses**: `POST /businesses` (self-claim, one claim per Place), `GET /businesses?placeId=...`, `GET /businesses/mine`.
- **Creators**: `POST /creators`, `PATCH /creators/me`, `GET /creators` (directory), `GET /creators/:username` (public profile) — one creator profile per user.
- **Events**: `POST /events`, `GET /events?category=&county=&dateFrom=&dateTo=`, `GET /events/:id`. Creating an event fires a best-effort push notification (see below) to users whose home county matches. `POST /events` requires a claimed business, a creator profile, or admin — not just any logged-in account (`EventsService.assertCanPostEvents`); reuses the same ownership-derived permission as business/creator capabilities rather than a separately stored "organizer" role, so it can't drift out of sync with whether someone actually still owns a business or creator profile.
- **Near Me**: `GET /places?lat=&lng=&radiusKm=` — all three or none; a Haversine SQL expression rather than PostGIS (fine at this catalog size, see Notes below).
- **Trip Planner / Weekend Explorer**: `POST /itineraries` ("Build My Liberia Trip" — duration/interests/budget, starts from Monrovia), `POST /itineraries/weekend` (starts from a given lat/lng, filtered by travel time instead of day count), `GET /itineraries` (mine, stops as stored — placeId only), `GET /itineraries/:id` (stops resolved to full Place objects). Both generators use the same greedy nearest-neighbor sequencing in `itineraries.service.ts`.
- **Two-factor authentication** (TOTP, RFC 6238 — see `src/auth/two-factor-crypto.ts` for why TOTP over SMS/email OTP): `POST /auth/2fa/setup` (generates a secret + QR code), `POST /auth/2fa/enable` (`{code}`, confirms setup and returns 10 one-time recovery codes — shown once, only bcrypt hashes are stored), `POST /auth/2fa/disable` (`{password}`). When 2FA is on, `POST /auth/login` returns `{twoFactorRequired: true, pendingToken}` instead of an accessToken; exchange it via `POST /auth/2fa/verify` (`{pendingToken, code}`, `code` is either a 6-digit authenticator code or an `xxxxx-xxxxx` recovery code). `pendingToken` is a short-lived (5m), purpose-scoped JWT that `JwtStrategy` refuses to accept as a normal bearer token. Set a real `TWO_FACTOR_ENCRYPTION_KEY` outside local dev (see `.env.example`) — TOTP secrets are encrypted at rest with it (AES-256-GCM), so a DB leak alone doesn't hand out working codes. `POST /auth/login` and `POST /auth/2fa/verify` are both rate-limited to 5 requests/minute/IP (`@nestjs/throttler`, `src/app.module.ts`) against password/code brute-forcing; every other endpoint gets a 120/minute default.
- **Push notifications**: needs a VAPID keypair in `.env`:
  ```bash
  npx web-push generate-vapid-keys
  ```
  Without it, `PushService` logs a warning at boot and silently no-ops sends — the app still runs fine. `GET /push/vapid-public-key` is public (the frontend needs it to create a browser subscription); `POST /push/subscribe`/`/unsubscribe` are authenticated.

## Phase 3

The marketplace layer (Tech Spec §3.3 / Business Plan §8). All 7 modules below are migrated, unit/e2e tested (`test/phase3.e2e-spec.ts`), and have a matching frontend in `../web`.

- **Bookings**: `POST /bookings` (request), `GET /bookings/mine`, `GET /bookings/business/:businessId` (owner-only), `PATCH /bookings/:id/respond` (`{action: "confirm"|"decline"}`, business owner only, one response per booking), `PATCH /bookings/:id/cancel` (guest only, while pending/confirmed). One entity covers hotel/tour/restaurant/transport bookings uniformly — `Business.type` already tells you which kind it is. **Payment**: request-to-book only — no real money moves through the API yet. `Booking.paymentProvider`/`paymentStatus`/`paymentReference` exist in the schema (provider defaults to `mtn_momo`, the intended real-world provider for Liberia) but are never called against a live payment API; wiring up real MTN Mobile Money capture is a follow-up that needs an actual merchant relationship this environment can't create.
- **Analytics**: `POST /analytics/events` (public, fire-and-forget — `{placeId, eventType: "view"|"save"|"contact_click"|"booking_request"}`, `204` on success), `GET /analytics/business/:businessId` (owner-only — totals + a 30-day daily breakdown). An anonymous append-only event log; no per-visitor data, no user tie.
- **Sponsored placements** ("Featured this week", Business Plan §8.3): `GET /sponsored-placements/active` (public), `GET /sponsored-placements` (admin, full history), `POST /sponsored-placements` (admin), `DELETE /sponsored-placements/:id` (admin). Time-boxed (`startDate`/`endDate`), distinct from Phase 1's `Place.featured` (general editorial curation, no dates).
- **Featured creators**: `PATCH /creators/:id/featured` (admin) — `Creator.findAll()` sorts featured creators first.
- **Admin verification**: `PATCH /admin/places/:id/verification`, `PATCH /admin/businesses/:id/verification` (both `{status: VerificationStatus}`, stamp `verifiedByUserId`/`verifiedAt`), `GET /admin/moderation-queue` (unverified businesses + the 20 most recent reviews).
- **Admin content management**: `POST`/`PATCH /admin/places`, `POST`/`PATCH /admin/activities`, `POST`/`PATCH /admin/businesses`, `PATCH /admin/events/:id`. The first way to create a Place through the API at all (Phase 1/2 only ever read the seeded catalog). `POST /admin/businesses` lets an admin seed an unowned "shell" business record (`ownerUserId` omitted) that a real owner can later claim via the existing `POST /businesses/:id/claim` — the Business Plan's "seed the catalog directly via outreach before relying on self-service claiming" mitigation.
- **B2B aggregate tourism analytics** (Business Plan §8.4): `GET /admin/analytics/aggregate?limit=10` — top places by visitor interest, and breakdowns by category/county, all built on the same analytics event log with no per-visitor data in the output.

All `/admin/*` and admin-only routes above are gated by `AdminGuard` (`src/auth/guards/admin.guard.ts`), which checks `req.user.isAdmin`. There's no self-service admin signup — promote a user directly in the database:

```bash
psql -U liberia360 -d liberia360 -c "UPDATE users SET is_admin = true WHERE email = 'you@example.com';"
```

Takes effect immediately without re-login: the JWT strategy re-fetches the full `User` row from the DB on every request rather than trusting a stale claim baked into the token.

## Notes

- Phase 1 has no PostGIS dependency — `latitude`/`longitude` are plain columns. Phase 2's "Near Me" radius search uses a Haversine expression in SQL instead; fine at this catalog size, worth revisiting if it grows a lot.
