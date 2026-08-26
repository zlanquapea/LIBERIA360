# LIBERIA360 API

NestJS REST API for the LIBERIA360 platform. PostgreSQL via TypeORM, JWT authentication, class-validator DTOs, OpenAPI documentation.

## Setup

```bash
cp .env.example .env
npm install
```

Requires a running PostgreSQL instance matching `.env`:

```bash
sudo -u postgres createuser liberia360 --pwprompt   # password: liberia360
sudo -u postgres createdb liberia360 -O liberia360
```

## Run

```bash
npm run start:dev     # http://localhost:3001, watch mode
```

- `GET /health` — liveness check (unprefixed).
- All feature endpoints are under `/api/v1`.
- Interactive API documentation (Swagger UI): `GET /api/docs`, generated from controller/DTO metadata via the `@nestjs/swagger` compiler plugin.

## Database

Schema is managed with TypeORM migrations (`synchronize` is off outside local bootstrapping).

```bash
npm run migration:run                                    # apply migrations
npm run migration:generate -- src/database/migrations/<Name>   # generate from entity changes
npm run seed                                              # load sample catalog data
```

## Tests

```bash
npm run test         # unit tests — no database required
npm run test:e2e     # HTTP-level tests against a real database
```

`test:e2e` requires a `liberia360_test` database (one-time setup):

```bash
createdb -O liberia360 liberia360_test
```

Each e2e spec file runs its own migrations and resets its fixtures, so it is safe to re-run and does not touch the development database.

```bash
npm run load-test     # local sanity check — see "Known limitations" below
```

`autocannon` (a devDependency, never shipped or run in production) carries one moderate advisory from a transitive `uuid` version inside its internal ID generator — not reachable from any request the tool makes, and inert outside this manual local script.

## Configuration

Environment variables (`.env.example` has the full annotated list):

| Variable | Purpose |
|---|---|
| `PORT`, `NODE_ENV`, `CORS_ORIGIN` | Server basics |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Database connection |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Auth token signing |
| `TWO_FACTOR_ENCRYPTION_KEY` | AES-256-GCM key for encrypting stored TOTP secrets |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL` | Web Push |
| `WEB_APP_URL` | Frontend origin, used to build links in transactional emails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM` | Email delivery |
| `STORAGE_DRIVER`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_PUBLIC_URL_BASE` | Upload storage backend |
| `SENTRY_DSN` | Crash reporting |
| `ADMIN_LOGIN_IP_ALLOWLIST` | Optional comma-separated IP/IPv4-CIDR allowlist restricting where isAdmin/isSuperAdmin accounts can log in from |

`JWT_SECRET` and `TWO_FACTOR_ENCRYPTION_KEY` ship with placeholder dev values; the app refuses to start in production with either unset. Every other integration (SMTP, VAPID, S3, Sentry, the admin login IP allowlist) degrades gracefully when unconfigured — the app runs, the corresponding feature is a no-op.

Without `SMTP_HOST`/`SMTP_USER`/`SMTP_PASSWORD` set, verification and password-reset emails are only logged to the server console (`[DEV] Email to ...`), never actually delivered — the API still reports success, since a broken mail provider must never block registration or a password-reset request. If a real deployment is missing these, "Sent — check your inbox" will show with no email ever arriving. The System & Operations admin page (`GET /admin/system/status`'s `mail` field, `POST /admin/system/test-email`) surfaces whether SMTP is configured and the outcome of the last real send attempt, and lets a super admin send themselves a one-click test email — the fastest way to confirm delivery actually works end to end without digging through logs.

## API reference

Base path `/api/v1` unless noted otherwise. Auth column: `—` public, `JWT` any authenticated user, `Owner` authenticated + resource-ownership check, `Admin` / `Super Admin` role-gated.

### Auth

| Method & path | Description | Auth |
|---|---|---|
| `POST /auth/register` | Create an account | — |
| `POST /auth/login` | Password login; returns `{twoFactorRequired, pendingToken}` if 2FA is enabled | — |
| `POST /auth/2fa/setup` | Generate a TOTP secret + QR code | JWT |
| `POST /auth/2fa/enable` | Confirm setup with a code; returns one-time recovery codes | JWT |
| `POST /auth/2fa/disable` | Disable 2FA (password-confirmed) | JWT |
| `POST /auth/2fa/verify` | Exchange a `pendingToken` + code/recovery code for a session | — |
| `GET /auth/me` | Current user profile | JWT |
| `PATCH /auth/me` | Update profile fields | JWT |
| `PATCH /auth/password` | Change password | JWT |
| `POST /auth/logout-all` | Revoke all other sessions | JWT |
| `DELETE /auth/me` | Anonymize and deactivate the account | JWT |
| `POST /auth/forgot-password` | Request a reset link (non-enumerating response) | — |
| `POST /auth/reset-password` | Consume a reset token | — |
| `POST /auth/verify-email` | Consume an email verification token | — |
| `POST /auth/resend-verification` | Resend the verification email | JWT |

`login`, `2fa/verify`, `forgot-password`, and `reset-password` are rate-limited to 5 requests/minute/IP. Every other endpoint defaults to 120/minute.

### Catalog

| Method & path | Description | Auth |
|---|---|---|
| `GET /places` | List/search places — `category`, `county`, `tag`, `type`, `q` (full-text search), `sort`, `page`, `limit`, `lat`/`lng`/`radiusKm` (all three or none) | — |
| `GET /places/:slug` | Place detail | — |
| `POST /places` | Self-service place submission — same field set as the admin's `POST /admin/places`, minus `slug`/`featured` (server-generated / editorial-only). Starts `submitted_for_review`, hidden from every route above until an admin approves it | JWT |
| `GET /places/mine` | The current user's own submitted places, regardless of review status | JWT |
| `PATCH /places/:id` | Edit a place the current user submitted. Editing a `rejected` place automatically resubmits it (`submitted_for_review`, clearing the rejection reason) — a `suspended` place does not auto-resubmit | JWT, owner |
| `GET /counties` | List counties | — |
| `GET /counties/:id/places` | Places scoped to a county | — |
| `GET /categories` | List categories | — |

`q` runs Postgres full-text search (`websearch_to_tsquery`, weighted `name`/`description`, GIN-indexed) rather than substring matching — supports stemming, multi-word queries, and search-engine syntax (quoted phrases, `or`, leading `-` to exclude). A `q` search with no explicit `sort` ranks by relevance; `sort` otherwise defaults to `featured`. `q` also matches against category membership, not just `name`/`description` text: singular/plural (`beach`/`beaches`) and a small alias table (`hike` → Hiking, `food` → Food & Dining, etc.) resolve to a category and are unioned into the match, so a category name that never appears in any place's own text still returns its places instead of zero results.

`GET /places`/`GET /places/:slug` only ever return an `approved` place — the same `reviewStatus` gate as `Business` (see the Businesses section below), reusing its exact enum shape (`draft`/`submitted_for_review`/`under_review`/`approved`/`rejected`/`suspended`). Every place created directly through the admin catalog (`POST /admin/places`, and every pre-existing row) defaults to `approved` — only self-service submissions start out unlisted.

### Reviews

| Method & path | Description | Auth |
|---|---|---|
| `POST /reviews` | Create a review (one per user per place) | JWT, 10/min |
| `GET /reviews?placeId=` | List reviews for a place | — |

`Place.rating`/`reviewCount` are recomputed from the reviews table on every write. `verifiedVisit` is set automatically when the reviewer has a confirmed booking with a business linked to that place.

### Businesses

| Method & path | Description | Auth |
|---|---|---|
| `POST /businesses` | Self-claim a place (one claim per place) | JWT |
| `PATCH /businesses/:id` | Update a claimed listing | Owner |
| `GET /businesses?placeId=` | List businesses for a place | — |
| `GET /businesses/mine` | Businesses owned by the current user | JWT |

### Creators

Profile fields cover the full "professional portfolio" set (category, home
county, contact info, languages, years of experience, certifications,
availability note) alongside the original social-handle/specialty fields.
Portfolio items and offerings (services & experiences) are separate tables,
not columns — see `CreatorPortfolioItem`/`CreatorOffering` — each with its
own CRUD scoped to the caller's own profile. `verified` was replaced with a
proper admin-set `verificationStatus` (`unverified`/`verified`), same shape
as Place/Business's verification workflow (see Admin section below).
`GET /creators/me` and `GET /creators/:username` both include `portfolioItems`
and `offerings`; the paginated `GET /creators` list does not (kept lightweight
for directory/card rendering), and additionally accepts `search`, `category`,
`countyId`, and `featuredOnly` query params.

| Method & path | Description | Auth |
|---|---|---|
| `POST /creators` | Create a creator profile (one per user) | JWT |
| `PATCH /creators/me` | Update own profile | JWT |
| `GET /creators/me` | Own profile, with portfolio + offerings | JWT |
| `GET /creators` | Directory (paginated, filterable) | — |
| `GET /creators/:username` | Public profile, with portfolio + offerings | — |
| `POST /creators/me/portfolio` | Add a portfolio item (image upload or external video link) | JWT |
| `PATCH /creators/me/portfolio/:itemId` | Edit a portfolio item's caption/category/order | JWT, owner |
| `DELETE /creators/me/portfolio/:itemId` | Remove a portfolio item | JWT, owner |
| `POST /creators/me/offerings` | Add a service/experience | JWT |
| `PATCH /creators/me/offerings/:offeringId` | Edit an offering | JWT, owner |
| `DELETE /creators/me/offerings/:offeringId` | Remove an offering | JWT, owner |

### Events

| Method & path | Description | Auth |
|---|---|---|
| `POST /events` | Create an event | JWT + claimed business, creator profile, or admin |
| `GET /events?category=&county=&dateFrom=&dateTo=&includePast=` | List/filter events — hides events whose `startDate` has already passed unless `dateFrom` or `includePast=true` is given | — |
| `GET /events/:id` | Event detail | — |
| `GET /events/mine` | Events the caller posted, including past ones | JWT |
| `PATCH /events/:id` | Edit an event | JWT, organizer or admin |
| `DELETE /events/:id` | Cancel/remove an event | JWT, organizer or admin |

Creating an event triggers a best-effort push notification to users whose home county matches.

### Uploads

| Method & path | Description | Auth |
|---|---|---|
| `POST /uploads/image` | Upload an image | JWT, 30/min |

Every upload is re-encoded into two renditions (auto-oriented, EXIF stripped): a full/hero JPEG (quality 78, capped at 1600px) and a small `-thumb` JPEG for card/grid thumbnails (quality 68, capped at 480px), sharing one UUID filename base (`<uuid>.jpg` / `<uuid>-thumb.jpg`) so the frontend can derive the thumbnail's URL from the returned full URL alone. Stored via `LocalStorageProvider` (default) or `S3StorageProvider` (`STORAGE_DRIVER=s3`, any S3-compatible provider), selected at boot.

### Push notifications

| Method & path | Description | Auth |
|---|---|---|
| `GET /push/vapid-public-key` | Public VAPID key | — |
| `POST /push/subscribe` | Register a browser push subscription | JWT |
| `POST /push/unsubscribe` | Remove a subscription | JWT |

Requires a VAPID keypair (`npx web-push generate-vapid-keys`); unconfigured, subscriptions are accepted but sends are silently skipped.

### Itineraries

| Method & path | Description | Auth |
|---|---|---|
| `POST /itineraries` | Generate a multi-day trip ("Build My Liberia Trip") | JWT |
| `POST /itineraries/preview` | Generate the same route as above, but return it unsaved — the guest-first trip planner, so a visitor with no account can see a real itinerary before deciding to log in and save it | — |
| `POST /itineraries/weekend` | Generate a trip from a location, filtered by travel time | JWT |
| `GET /itineraries` | List own itineraries | JWT |
| `GET /itineraries/:id` | Itinerary detail, stops resolved to full places | Owner or collaborator |
| `GET /itineraries/shared-with-me` | Itineraries owned by others the user was invited to | JWT |
| `PATCH /itineraries/:id` | Rename the trip | Owner or collaborator |
| `DELETE /itineraries/:id` | Delete the trip outright — collaborators and invitations cascade away with it | Owner |
| `DELETE /itineraries/:id/collaborators/:userId` | Remove a confirmed collaborator, or leave | Owner or self |
| `POST /itineraries/:id/stops` | Add a stop | Owner or collaborator |
| `PATCH /itineraries/:id/stops/:placeId` | Edit stop notes | Owner or collaborator |
| `DELETE /itineraries/:id/stops/:placeId` | Remove a stop | Owner or collaborator |

Generation uses greedy nearest-neighbor sequencing. Non-members get 404 (not 403) on member-only routes. `/itineraries/preview` runs the exact same candidate-selection/sequencing as `/itineraries` without persisting anything — "save this trip" after logging in is just calling `/itineraries` again with the same inputs, deterministic against unchanged catalog data, rather than a second endpoint that has to trust a client-supplied draft back into the DB.

### Trip Collaboration & Invitations

Inviting someone onto a trip goes through a real pending → viewed → accepted/declined/expired lifecycle (`trip_invitations` table) instead of adding a collaborator on the spot — and works for people who don't have an account yet, not just existing users. See `TripInvitation`'s class doc (`api/src/itineraries/entities/trip-invitation.entity.ts`) for the full data-model reasoning (why there's no separate "Sent" state, how an email-only invite gets linked to a brand-new account without letting it be hijacked, etc).

| Method & path | Description | Auth |
|---|---|---|
| `GET /itineraries/:id/invitations/search-people` | "People you may want to invite" — platform users matching `?q=`, minus anyone already on the trip | Owner |
| `POST /itineraries/:id/invitations` | Invite one or many people at once, each either `{userId}` or `{email}` | Owner |
| `GET /itineraries/:id/invitations` | The trip's invitation list with each one's status, for the People/Participants panel | Owner |
| `POST /itineraries/:id/invitations/:invitationId/resend` | Resend a still-pending invite (fresh token, fresh 14-day expiry) | Owner |
| `DELETE /itineraries/:id/invitations/:invitationId` | Revoke an invitation outright | Owner |
| `GET /invitations/token/:token` | Public preview of an invite link — trip title/destination/duration/organizer, no stop list or contact info | — |
| `POST /invitations/token/:token/accept` \| `.../decline` | Respond to an invite via its emailed link | JWT |
| `GET /invitations/mine` | Every open invitation addressed to this account — the in-app "My Invitations" inbox | JWT |
| `POST /invitations/:id/accept` \| `.../decline` | Respond to an invite already linked to this account, without needing the original link (the plaintext token is never stored, only its hash) | JWT |

Accepting an invitation creates an `ItineraryCollaborator` row (unchanged from before) and emails the organizer that the person joined. `POST /auth/register` accepts an optional `inviteToken` so signing up from an invite link automatically links the pending invitation to the new account.

### Bookings

| Method & path | Description | Auth |
|---|---|---|
| `POST /bookings` | Request a booking | JWT |
| `GET /bookings/mine` | Own booking requests | JWT |
| `GET /bookings/business/:businessId` | Incoming requests for a business | Owner |
| `PATCH /bookings/:id/respond` | Confirm or decline (`{action}`) | Owner |
| `PATCH /bookings/:id/cancel` | Cancel while pending/confirmed | Guest |

One `Booking` entity covers hotel/tour/restaurant/transport, distinguished by `Business.type`. Request-to-book only: `paymentProvider`/`paymentStatus`/`paymentReference` exist in the schema (`paymentProvider` defaults to `mtn_momo`) but are not wired to a live payment API.

### Booking messages

| Method & path | Description | Auth |
|---|---|---|
| `POST /bookings/:bookingId/messages` | Post a message (1–2000 chars) | Guest or business owner |
| `GET /bookings/:bookingId/messages` | List messages, oldest first | Guest or business owner |

Plain text only; no attachments, read receipts, or editing.

### Analytics

| Method & path | Description | Auth |
|---|---|---|
| `POST /analytics/events` | Log an event (`view`/`save`/`contact_click`/`booking_request`) | — |
| `GET /analytics/business/:businessId` | Totals + 30-day daily breakdown | Owner |

Append-only anonymous event log; no per-visitor data.

### Sponsored placements

| Method & path | Description | Auth |
|---|---|---|
| `GET /sponsored-placements/active` | Currently active placements | — |
| `GET /sponsored-placements` | Full history | Admin |
| `POST /sponsored-placements` | Create a time-boxed placement | Admin |
| `DELETE /sponsored-placements/:id` | Revoke | Admin |

Distinct from `Place.featured` (undated editorial curation).

### Freshness reports

| Method & path | Description | Auth |
|---|---|---|
| `POST /freshness-reports` | Report `still_here` / `no_longer_here` (upserts per user/place) | JWT |
| `GET /freshness-reports/mine?placeId=` | The current user's own report | JWT |

3+ independent `no_longer_here` reports within 90 days surface the place in the admin moderation queue.

### Content reports

| Method & path | Description | Auth |
|---|---|---|
| `POST /reports` | Report a review or event (`{targetType, targetId, reason, details?}`, upserts per user/target) | JWT, 20/min |

`reason` is one of `spam`/`inappropriate`/`fake`/`other`. 3+ independent reports on the same review or event within 90 days surface it in the admin moderation queue's `flaggedContent`, alongside a per-reason breakdown and the flagged content itself.

### Admin

All routes below require `AdminGuard` (`req.user.isAdmin`) unless marked Super Admin.

| Method & path | Description |
|---|---|
| `PATCH /admin/places/:id/verification` | Set place verification status |
| `PATCH /admin/places/:id/review-status` | Approve/reject/request changes (`under_review`)/suspend a place's publish status (`{status, reason?}`) — distinct from verification above: this is "is it visible at all," not "how much do we vouch for it" |
| `POST /admin/places/bulk-review-status` | Same transition as above, applied to up to 50 places at once (`{ids, status, reason?}`) — returns `{succeeded, failed}` so one bad id doesn't abort the rest of the batch |
| `PATCH /admin/businesses/:id/verification` | Set business verification status |
| `PATCH /admin/businesses/:id/review-status` | Approve/reject/request changes/suspend a business's publish status (`{status, reason?}`) |
| `POST /admin/businesses/bulk-review-status` | Bulk sibling of the above (`{ids, status, reason?}`, same `{succeeded, failed}` shape) |
| `POST /admin/business-content/bulk-review-status` | Bulk approve/reject for business-authored content (`{ids, status, reason?}`) |
| `PATCH /admin/creators/:id/verification` | Set creator verification status (`unverified`/`verified`) |
| `GET /admin/moderation-queue` | Pending businesses, pending places awaiting a review decision (`pendingPlaces` — the same submissions `GET /admin/places?reviewStatus=submitted_for_review` shows, surfaced here too so a self-submitted place doesn't sit invisible until an admin happens to filter for it), recent reviews, possibly-closed places, flagged content |
| `GET /admin/places?page=&limit=&search=&reviewStatus=` | Every place regardless of review status (unlike the public `GET /places`), with the submitter (`owner`) populated — the review queue |
| `GET /admin/places/data-quality` | Flags places with an editorial problem a review-status pass wouldn't catch: slug that no longer matches the current name (see `PATCH /admin/places`'s auto-re-slug below, which now closes off the main way this could happen — this stays as a safety net for anything the auto-derivation doesn't cover, e.g. a slug set by hand that no longer matches), missing/too-short/placeholder description, and no photos. Registered ahead of `GET /admin/places/:id` below since Nest matches routes in declaration order |
| `GET /admin/places/:id` | Single place by id, any review status, with `owner`, `category`, `county`, `activities` — what the review panel loads |
| `POST` / `PATCH /admin/places` | Create/update places — renaming a place without also typing a new slug re-derives the slug from the new name (deduped against any other place's slug), instead of leaving it frozen to the old name |
| `DELETE /admin/places/:id` | Delete a place — blocked (409) if it still has a linked business or events | Super Admin |
| `POST` / `PATCH /admin/categories` | Create/update catalog categories (previously seed-data-only) — renaming one re-derives its slug the same way `PATCH /admin/places` does |
| `DELETE /admin/categories/:id` | Delete a category — blocked (409) if any place still uses it | Super Admin |
| `POST` / `PATCH /admin/activities` | Create/update activities |
| `DELETE /admin/activities/:id` | Delete an activity | Super Admin |
| `POST` / `PATCH /admin/businesses` | Create/update businesses, including unowned "shell" listings |
| `DELETE /admin/businesses/:id` | Delete a business (its bookings cascade with it) | Super Admin |
| `PATCH /admin/events/:id` | Update an event |
| `DELETE /admin/events/:id` | Remove an event (moderation) |
| `DELETE /admin/reviews/:id` | Remove a review (moderation) — recomputes the place's rating |
| `PATCH /admin/counties/:id` | Update a county's safety/practical-info panel |
| `DELETE /admin/counties/:id` | Delete a county — blocked (409) if it still has places or events in it | Super Admin |
| `PATCH /creators/:id/featured` | Toggle featured status |
| `GET /admin/analytics/aggregate?limit=` | B2B aggregate analytics: top places, category/county breakdowns |
| `GET /admin/analytics/overview?days=` | Decision-driving analytics: current-vs-previous-period deltas for sign-ups/reviews/bookings/page views (computed live from existing timestamped tables, not a stored snapshot), top places, neglected (zero-view) places, top reviewers, and rule-based insight sentences |
| `GET /admin/users?page=&limit=&search=&travelerType=&isAdmin=` | Every account (not just admins — see `/admin/team` for that), paginated, searchable by name/email | Super Admin |
| `GET /admin/system/status` | Runtime status: environment, API uptime, storage driver, DB SSL, which optional integrations (email, push, crash reporting) are configured, and email delivery diagnostics (SMTP configured? what happened on the last real send attempt, success or failure with the error) — flags and outcomes only, never credentials | Super Admin |
| `POST /admin/system/test-email` | Send a real test email to the calling admin's own address and report the actual outcome — the fastest way to tell "SMTP isn't configured" apart from "SMTP is configured but wrong" without reading server logs | Super Admin |
| `GET /admin/team` | List admins and super admins | Super Admin |
| `GET /admin/team/search?email=` | Look up a user to promote | Super Admin |
| `POST /admin/team` | Create a brand-new admin/super-admin account (no prior registration needed) and email them a set-password link — re-invites in place instead of conflicting if the email belongs to a still-pending (never-activated) invite | Super Admin |
| `POST /admin/team/:userId/resend-invite` | Re-send a still-pending invite with a fresh set-password link | Super Admin |
| `PATCH /admin/team/:userId` | Set a user's admin/super-admin roles | Super Admin |
| `GET /admin/audit-log` | Paginated log of verification changes, role changes, sponsored-placement create/revoke, and content removal — now including the acting admin's IP and user-agent | Super Admin |
| `GET /admin/kpis` | Platform-health numbers: users, signups (7d), places, business claim rate, reviews, bookings by status | Super Admin |
| `GET /admin/security/login-activity?onlyFailed=` | Paginated login attempts (success and failure), with IP/device | Super Admin |
| `GET /admin/security/overview` | Failed-login counts (1h/24h), distinct failing IPs (24h), admin-team 2FA adoption | Super Admin |
| `POST /admin/security/users/:id/revoke-sessions` | Force-end every active session on an account (no password needed) — audit-logged | Super Admin |
| `GET /admin/settings/application` | Read the moderation/security-alert thresholds below — materializes the singleton settings row with its defaults on first read | Super Admin |
| `PATCH /admin/settings/application` | Update any of the thresholds below (partial update, `{freshnessFlagThreshold?, freshnessWindowDays?, reportFlagThreshold?, reportWindowDays?, failedLoginAlertThreshold1h?, failedLoginAlertThreshold24h?}`) — audit-logged, stamps who changed it | Super Admin |

Proactive alerting: `LoginActivityService.record()` emails every super admin (`MailService.sendFailedLoginAlert`) the instant failed logins first exceed the configured 1h/24h thresholds (5/20 by default — see Settings > Application) — a one-time alert per crossing, not a repeat on every subsequent failed attempt, so an ongoing attack doesn't spam every super admin's inbox. Previously the same numbers only surfaced passively on the Security Alerts page, so nothing happened unless someone was already looking.

Settings > Application (`src/settings/`): the moderation-queue "possibly closed" and "flagged content" thresholds, plus the two failed-login alert thresholds above, used to be hardcoded constants that needed a deploy to change. They now live in a single-row `application_settings` table (materialized lazily with the same defaults the constants used to have, so an unmigrated or freshly-deployed environment behaves identically until a super admin actually changes something) and are editable from Settings > Application in the admin panel.

The first admin is granted directly in the database:

```bash
psql -U liberia360 -d liberia360 -c "UPDATE users SET is_admin = true, is_super_admin = true WHERE email = 'you@example.com';"
```

Role changes take effect immediately — the JWT strategy re-fetches the user row from the database on every request.

## Security

- **Password/session**: bcrypt password hashing, JWT bearer auth, per-user `tokenVersion` for session revocation (password change / "sign out everywhere" bump it and invalidate every other outstanding token).
- **Two-factor authentication**: TOTP (RFC 6238), encrypted-at-rest secrets (AES-256-GCM), one-time recovery codes stored as bcrypt hashes, a short-lived purpose-scoped `pendingToken` for the login→2FA handoff.
- **Rate limiting**: `@nestjs/throttler`, 120/min global default; 5/min on login/2FA-verify/password-reset; 10/min on review creation; 30/min on uploads.
- **HTTP hardening**: `helmet()` on every response (`Cross-Origin-Resource-Policy: cross-origin`, since `/uploads/*` is meant to be loaded cross-origin by the web app); graceful shutdown (`enableShutdownHooks`) so in-flight requests complete on `SIGTERM`.
- **Account lifecycle**: non-enumerating forgot-password, single-use time-limited tokens (SHA-256 hashed at rest) for password reset and email verification, in-place account anonymization on delete (no cascading hard-delete through reviews/bookings/messages).
- **Boot-time validation**: refuses to start in production if `JWT_SECRET` or `TWO_FACTOR_ENCRYPTION_KEY` are still the committed placeholder values.
- **Uploads**: every image is re-encoded server-side (strips EXIF, resizes, recompresses) regardless of storage backend.
- **Audit trail**: `admin_actions` table records verification changes, admin role changes, sponsored-placement create/revoke, content removal, and forced session revocations — each row includes the acting admin's IP address and user-agent (see `src/common/request-info.ts`), exposed via `GET /admin/audit-log` (super-admin-only).
- **Content moderation**: any signed-in user can report a review or event (`POST /reports`); 3+ independent reports surface it in the admin moderation queue for removal (`DELETE /admin/reviews/:id`, `DELETE /admin/events/:id`).
- **Login activity & session revocation**: every completed login attempt (password-only, or the final 2FA step for accounts that have it) is recorded — success or failure, with IP/device (`login_activity` table, `src/security/`) — the raw material for basic brute-force detection (a burst of failures against one email or IP) and for a super admin to see who's signing in to admin accounts and from where. A super admin can force-end any account's sessions immediately, without that account's password, via `POST /admin/security/users/:id/revoke-sessions` — reuses the same `tokenVersion` bump as the existing self-service "sign out everywhere," just triggered by someone other than the account holder.
- **Admin login IP allowlist**: optional (`ADMIN_LOGIN_IP_ALLOWLIST`, see `.env.example`) CIDR/exact-IP restriction on which addresses an `isAdmin`/`isSuperAdmin` account can log in from (`src/auth/ip-allowlist.ts`) — a blocked attempt fails the exact same way a wrong password would, so a prober can't distinguish "wrong password" from "right password, wrong network." No-op when unset, same as every other optional integration.
- **Dependencies**: `npm audit` clean (0 vulnerabilities) as of the current dependency set.

## Observability

- **Structured logging**: JSON-per-line log output in production (`NODE_ENV=production`), human-readable console output otherwise.
- **Crash reporting**: unhandled exceptions (5xx, non-`HttpException`) reported to Sentry when `SENTRY_DSN` is set; expected 4xx errors are not reported.
- **Health checks**: `GET /health` (liveness), `GET /health/ready` (readiness, checks DB connectivity).

## API documentation

`GET /api/docs` — Swagger UI, generated from `class-validator` DTOs and controller decorators via the `@nestjs/swagger` compiler plugin (`nest-cli.json`). Bearer-auth is wired up on every guarded route.

## Known limitations

- No PostGIS: `latitude`/`longitude` are plain columns and "Near Me" uses a Haversine SQL expression instead of spatial indexing. Adequate at the current catalog size.
- Bookings do not process real payments; MTN Mobile Money integration requires a merchant relationship not available in this environment.
- `npm run load-test` (`scripts/load-test.js`, autocannon) is a local single-instance sanity check against `/health`, catalog browse/search, and a place detail page — not a production capacity number. Run it again once there's a real deployed target and a traffic estimate.
- IP addresses recorded in the audit trail and login activity log (`src/common/request-info.ts`) come from Express's own `req.ip`, which only reflects `X-Forwarded-For` if the app has `trust proxy` configured — it doesn't yet. Behind a reverse proxy or load balancer without that setting, every request appears to come from the proxy's own address — the same underlying gap as `@nestjs/throttler`'s per-instance rate limiting (see DEPLOYMENT.md's "Known limitations").
