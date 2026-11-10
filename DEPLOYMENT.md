# Production deployment checklist

Everything below is either enforced by the app itself (fails fast or logs a
warning) or a real operational decision someone has to make before this goes
live — not just "nice to have." Nothing here needs code changes; it's the
list of what a human has to actually configure, run, or decide. See
`api/README.md` and `web/README.md` for what each feature/env var does in
more depth — this is the "am I ready to launch" checklist, not the feature
docs.

## 0. Just want a temporary link for friends to test?

You don't need to work through this whole checklist for a short testing
window. Two options, both fine for this:

- **Render**: `render.yaml` in the repo root is a Blueprint that deploys
  Postgres + the API + the web app together in a few clicks (Render
  dashboard → New → Blueprint → connect this repo → Apply). Still needs real
  values for section 1's two secrets (Blueprint auto-generates those) and
  section 3's domain/CORS wiring (Blueprint leaves those as placeholders you
  fill in once Render assigns your `*.onrender.com` URLs). See `render.yaml`'s
  own comments for the exact steps. The Blueprint also generates
  `INTERNAL_PROXY_SECRET` on the API and shares it with the web service
  (section 3's per-visitor rate limiting) — nothing to fill in.
- **Railway**: no blueprint file — deploy from the dashboard as two services
  from this same repo (one for `api`, one for `web`) plus a Postgres
  database, wiring `DB_HOST`/`DB_PORT`/etc. to the database's variables. The
  root `package.json`'s `build`/`start` scripts (`npm run build` /
  `npm start`) exist specifically so Railway's zero-config builder
  (Railpack) can auto-detect a start command for the `api` service without
  you having to set one manually — they build and start `api` specifically,
  since a single root script can't serve two different apps. The `web`
  service still needs an explicit custom Start Command set in Railway's UI
  (`npm run start --workspace=web -- -p $PORT`), since it's the second app
  in this repo and root auto-detection can only point at one.

  Also set the same `INTERNAL_PROXY_SECRET` on **both** services (see
  "Rate limiting behind the web server" in section 3) — without it the
  whole site shares one rate-limit budget.
  Railway bills for the memory each service actually uses, minute by
  minute, so how these two processes are started matters — see
  [Memory](#12-memory) below for the settings both start scripts apply and
  the two optional Start Commands that trim a little more.

  Video thumbnail generation (`api/src/uploads/video-thumbnail.ts`) shells
  out to `ffmpeg`, which neither Railpack's auto-detected build nor Render's
  native Node runtime installs by default, and neither platform's native
  runtime grants the root access a plain `apt-get install` needs (unlike
  this repo's own CI workflow, which runs on a GitHub Actions runner with
  passwordless sudo — see `.github/workflows/ci.yml`). On Railway, add an
  `apt.txt` (or equivalent Nixpacks config) listing `ffmpeg` — Nixpacks'
  own supported mechanism for extra system packages, no root needed. On
  Render, this means switching the `api` service to Render's Docker
  runtime with a Dockerfile that installs `ffmpeg` (see `render.yaml`'s
  own comment on its `api` service for why the native runtime can't do
  this at all). Without either, video uploads still succeed — the
  controllers already treat a missing binary as a soft failure — just
  with no generated poster image (`thumbnailUrl: null`).

  Railway's free/Hobby tier caps a project at 5 services, and `api` + `web`
  already use 2 — adding Railway's own one-click Postgres plugin (a 3rd
  service) requires their paid Pro plan. If you don't want to pay just to
  let friends test the app, use a free database from **outside** Railway
  instead (e.g. [neon.tech](https://neon.tech) — free tier, no card
  required, gives you a ready-to-use Postgres in under a minute):
  1. Sign up at neon.tech, create a project, and copy the connection
     details it shows you (host, port, username, password, database name).
  2. On the `api` service's Variables tab, set `DB_HOST`/`DB_PORT`/
     `DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` to those values directly
     (typed in, not a `${{ }}` reference — there's no Railway-side Postgres
     service to reference since the database now lives outside Railway).
  3. Also set `DB_SSL=true`. Neon (and every other free managed Postgres)
     requires an encrypted connection and refuses a plain one — without
     this the `api` service fails to connect the exact same way as having
     no database configured at all.

Either way: everything else in this checklist (real payments, S3 storage,
SMTP, Sentry) is optional for a quick test and safe to leave unset — just
know that uploaded photos won't survive a redeploy on either platform's free
tier, and password-reset/verification emails log instead of sending unless
you add real `SMTP_*` vars.

## 1. Secrets

Generate real values for both — a fresh checkout ships with obviously-fake
defaults on purpose, so local dev works with zero setup:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # TWO_FACTOR_ENCRYPTION_KEY
```

A third value, `INTERNAL_PROXY_SECRET`, must be set to the **same** string on
the API and the web service — see "Rate limiting behind the web server" in
section 3 for what it does. Not fatal if missing (the API logs a warning at
boot instead), but don't launch without it:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # INTERNAL_PROXY_SECRET (both services)
```

You don't have to remember this: `validateProductionConfig` (`api/src/config/validate-production-config.ts`)
runs at boot whenever `NODE_ENV=production` and **refuses to start** if
either is still the committed dev placeholder — the two failure modes where
booting anyway would be actively dangerous (forgeable login tokens; every
account's TOTP secret decryptable straight out of a DB dump), not just
incomplete.

## 2. Database

- A real PostgreSQL instance, not the throwaway one from local dev. Set
  `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE`. If it's a
  free managed Postgres outside your hosting platform (Neon, Supabase,
  ElephantSQL, ...), also set `DB_SSL=true` — those require TLS and refuse
  a plain connection.
- Leave `DB_SYNCHRONIZE` unset/`false` (the default) — schema changes are
  migrations-only outside local bootstrapping.
- **Run migrations as a release step, before new instances take traffic —
  not on every instance's boot.** `npm run migration:run --workspace=api`
  is safe to run repeatedly (only pending migrations apply), but if you
  scale to multiple instances and each one runs migrations on its own boot,
  they can race against each other on a fresh deploy. Run it once, as its
  own step, ahead of starting (or restarting) app instances:
  - Heroku: a release phase (`release: npm run migration:run --workspace=api` in `Procfile`)
  - Render / Railway: a "pre-deploy command"
  - Fly.io: `release_command` in `fly.toml`
  - Your own CI/CD: a deploy-script step before `docker run`/restart
  - Kubernetes: a `Job` (or `initContainer` on a single-replica migrator) ahead of the Deployment rollout

## 3. Domain & CORS

Four different places need the real domain(s) once you have them — these
are independent, easy to miss one:

| Where | Set to |
|---|---|
| `api/.env` → `CORS_ORIGIN` | the production **web** origin (so the API accepts requests from it) |
| `api/.env` → `WEB_APP_URL` | the production **web** origin (used to build links *inside* verification/reset emails — the API has no view layer of its own) |
| `web/.env.local` → `API_ORIGIN` | the production **API** origin, bare — no `/api/v1` suffix, no trailing slash (server-only: the browser talks to the same-origin `/api` proxy, never this host directly) |
| `web/.env.local` → `NEXT_PUBLIC_SITE_URL` | the production **web** origin (schema.org JSON-LD's `url` fields need an absolute URL for SEO — falls back to a placeholder otherwise, which is fine pre-launch but shouldn't ship to real search results) |

Existing Railway/Render web services that still define the former
`NEXT_PUBLIC_API_URL=https://your-api.example/api/v1` variable remain
compatible. The web server uses it only when `API_ORIGIN` is absent and removes
the legacy `/api/v1` suffix automatically. Set `API_ORIGIN` when convenient;
if both variables exist, `API_ORIGIN` takes precedence.

### Rate limiting behind the web server

The API rate-limits per client address (`@nestjs/throttler`: 120
requests/minute per endpoint by default, 5/minute on login, 2FA,
password reset — see `api/src/auth/auth.controller.ts`). But browsers never
call the API directly: their `/api/*` requests are reverse-proxied by the web
server (`web/next.config.js` rewrites), and pages are rendered from
server-side fetches made by the web server. Left alone, the API sees **the
web server's address on every request** and the whole site shares one
budget — a few dozen simultaneous visitors start getting HTTP 429s, and
five bad logins from anyone lock everyone out of login for a minute.

So the web server tells the API which visitor each request is for, and the
API believes it only when the request also carries a secret the two services
share:

| Service | Variable | Value |
|---|---|---|
| `api` **and** `web` | `INTERNAL_PROXY_SECRET` | the same random string on both, at least 32 characters (section 1 has a generator). Server-only — never give it a `NEXT_PUBLIC_` name. |
| `web` | `TRUST_PROXY_HOPS` | how many reverse proxies sit between the visitor and the **web** server. Defaults to `1` (one platform load balancer). |
| `api` | `TRUST_PROXY_HOPS` | how many reverse proxies sit in front of the **API** itself. Only matters for clients that reach the API without going through the web server; defaults to `0`. |

How it works, so the settings above make sense:

- `web/src/proxy.ts` reads the visitor's address from `X-Forwarded-For` —
  counting `TRUST_PROXY_HOPS` entries **from the right**, since only the
  entries your own proxies appended can be trusted; anything further left is
  whatever the client chose to send. It writes that address onto the request
  as `X-Liberia360-Client-Ip` (overwriting any value the client sent), adds
  `X-Liberia360-Proxy-Secret` on `/api/*` requests before they are rewritten
  to the API, and `web/src/lib/visitor-headers.ts` adds the same pair to
  server-side fetches.
- The API (`api/src/common/client-ip.ts`) uses `X-Liberia360-Client-Ip` for
  rate limiting, the login-activity log, the admin audit trail and
  `ADMIN_LOGIN_IP_ALLOWLIST` **only** when the secret matches. Anyone
  calling the API directly, without the secret, is attributed to the address
  they connected from, exactly as before — the header alone is ignored, so it
  can't be used to impersonate another visitor or to dodge the login limit.
- If `INTERNAL_PROXY_SECRET` is missing on either side, nothing breaks: the
  API falls back to the old shared-budget behaviour and warns about it at
  boot.

**Check `TRUST_PROXY_HOPS` on the web service after deploying.** Sign in,
then look at Admin → Security → login activity: the address recorded for your
login should be your own public IP. If it shows a load balancer / CDN
address instead (the same one for every user), there is one more proxy in
front of the web server than configured — raise `TRUST_PROXY_HOPS` on the
web service by one and check again. Setting it too *high* is the unsafe
direction: it makes the web server read an entry the client controls. Some
platforms (Render among them, per its community forum) append to a
client-supplied `X-Forwarded-For` rather than replacing it, which is exactly
why the count is taken from the right.

Keep the API reachable only through the web server where your platform
allows it (a private/internal service). It isn't required — a direct caller
can't forge a visitor address without the secret — but direct callers are
all rate-limited as whatever address the API sees them connect from.

## 4. Object storage for uploaded photos

`STORAGE_DRIVER=local` (the default) writes to local disk on whichever
instance handled the upload — doesn't survive a redeploy, and a second
instance behind a load balancer can't see files the first one wrote.
`validateProductionConfig` warns (doesn't block boot) if this is still set
in production. Before real users start uploading listing photos:

```bash
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_PRIVATE_BUCKET=...    # required — see below
S3_REGION=...            # "auto" is fine for R2; a real AWS region for S3
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=...          # only for a non-AWS provider (R2, MinIO, ...)
S3_PUBLIC_URL_BASE=...   # a CDN in front of the bucket, or the bucket's own public URL
```

Works with AWS S3, Cloudflare R2, DigitalOcean Spaces, or MinIO. `S3_BUCKET`
needs to actually be publicly readable (or fronted by a CDN that is) —
`S3StorageProvider` deliberately never sets an object ACL, since modern
buckets default to ACLs disabled ("bucket owner enforced").

`S3_PRIVATE_BUCKET` must be a **second, distinct** bucket with no
public-read policy — it's where anything uploaded via `savePrivate()`
goes (currently just pharmacy prescriptions). `validateProductionConfig`
refuses to boot with `STORAGE_DRIVER=s3` if this is unset, or if it's set
to the same bucket as `S3_BUCKET`: either way, a private upload would
land in the publicly-readable bucket, and anyone who discovers or leaks
an object key bypasses every access check that route enforces.

## 5. Transactional email

Unset SMTP settings are safe (`MailService` logs the email body instead of
sending it — that's the intended local-dev experience), but real users need
real delivery for password reset and email verification to actually work:

```bash
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_SECURE=false   # true if your provider needs implicit TLS (usually port 465)
MAIL_FROM=LIBERIA360 <no-reply@yourdomain.com>
```

`validateProductionConfig` warns (doesn't block boot) if `SMTP_HOST` is
still unset in production.

## 6. Push notifications (optional)

```bash
npx web-push generate-vapid-keys
```

Unset is safe — `PushService` no-ops and the rest of the app works exactly
the same either way, just without this one feature.

## 7. Crash reporting (optional)

Unset is safe — both sides just log locally instead of reporting anywhere,
same "no-op unless configured" shape as everything else optional in this
checklist:

```bash
# api/.env
SENTRY_DSN=...

# web/.env.local
NEXT_PUBLIC_SENTRY_DSN=...
```

The frontend side (`web/src/lib/error-reporting.ts`) is deliberately
`@sentry/browser`, not the full `@sentry/nextjs` SDK — it catches
client-side JS errors (via the two React error boundaries and the global
`window` listeners wired into the root layout), not Next.js server-side
rendering errors. `validateProductionConfig` warns (doesn't block boot) if
`SENTRY_DSN` is unset in production.

## 8. Health checks

- `GET /health` — liveness. Doesn't touch the database on purpose (a DB
  blip shouldn't get an orchestrator to kill and restart an otherwise
  healthy process). Point your platform's liveness probe here.
- `GET /health/ready` — readiness. Runs `SELECT 1` against the database and
  returns `503` if it fails. Point your platform's readiness probe here so
  traffic isn't routed to an instance whose DB pool hasn't connected yet
  (right after a fresh deploy, for instance).

Both are unprefixed (not under `/api/v1`) so a probe config doesn't need to
know the API's route prefix.

## 9. Seed data

`npm run seed --workspace=api` loads **Stage 1 sample/demo data** — fine for
a fresh local checkout or a demo environment, not something to run against
a real production database. The real catalog-loading path for launch is the
admin dashboard's content management (`POST`/`PATCH /admin/places`, etc. —
see `api/README.md`'s Phase 3 section) plus outreach-driven business
self-claiming, not the seed script.

## 10. Admin access

No self-service admin signup by design. Promote the first real admin
directly in the database once you have a real account to promote:

```bash
psql -U liberia360 -d liberia360 -c "UPDATE users SET is_admin = true WHERE email = 'you@example.com';"
```

Takes effect on that user's very next request — no re-login needed (see
`api/README.md`).

## 11. Known limitations, honestly listed

- **Rate limiting is per visitor only when `INTERNAL_PROXY_SECRET` is set on
  both services** (section 3). Without it every visitor shares the web
  server's single budget.
- **Rate limiting is per-instance, in-memory** (`@nestjs/throttler`'s
  default storage). Scale to N instances behind a load balancer and the
  *effective* limit on login/2FA/password-reset/uploads becomes roughly N×
  the configured number, since each instance counts independently. Fine at
  single-instance or small scale; revisit with a shared store (Redis) if
  you scale out and the limits need to hold precisely.
- **PostGIS**: "Near Me" uses a Haversine SQL expression instead of a real
  geospatial index — fine at the current catalog size, worth revisiting if
  the catalog grows a lot. Documented technical debt, not a launch blocker.
- **Load testing**: `npm run load-test --workspace=api` (`api/scripts/load-test.js`)
  is a ready-to-run local single-instance sanity check (autocannon — no
  system binary to install) against `/health`, catalog browse/search, and
  a place detail page. It correctly distinguishes the rate limiter's
  expected 429s under sustained load from real failures, but a laptop
  running one instance isn't a production capacity number — re-run it
  against the real deployed target once there's one, with a traffic
  estimate to size connections/duration against.
- **MTN Mobile Money / real payment capture**: intentionally out of scope
  here. `Booking.paymentProvider`/`paymentStatus`/`paymentReference` exist
  in the schema (provider defaults to `mtn_momo`, the intended real-world
  provider for Liberia), but nothing calls a live payment API — bookings
  are request-to-book only today. Wiring up real capture needs an actual
  MTN merchant relationship this environment can't create.
- **Crash reporting only covers client-side frontend errors and API-side
  exceptions** — see section 7 above for the frontend-specific caveat.
- **Public catalog pages (map, place/business/category/county pages,
  search, home) fetch the API fresh on every request** — `web/src/lib/api.ts`
  used to cache these for 60s (Next.js ISR) but that window was reported as
  a real problem: an admin's correction (e.g. recategorizing a place) could
  keep showing the old value on the map for longer than expected,
  especially across multiple instances/edge caches. Reported directly
  ("Royal Hotel" still showing under Hospital after being recategorized),
  fixed by dropping the cache entirely (`cache: 'no-store'`). At this
  catalog's size this trades a bit of origin load for the public site never
  visibly disagreeing with an admin correction; revisit only if the catalog
  or traffic grows enough for that origin load to matter.

## 12. Memory

On usage-billed hosts (Railway) the bill is mostly resident memory × time,
so the defaults below are chosen to keep both services' steady-state
footprint down. Numbers are from running the production builds locally
against Postgres with the same scripted traffic before and after.

| | Before | After |
|---|---|---|
| `api` — peak while booting | 1,424 MB (29 s) | 140 MB (2 s) |
| `api` — idle | 193 MB | 139 MB |
| `api` — after ~500 catalog requests | 213 MB | 154 MB |
| `api` — after 8 phone-photo uploads | 295 MB | 182 MB |
| `web` — idle | 148 MB | 125 MB |
| `web` — after ~190 page requests | 210–250 MB | 174 MB |

What produces those numbers, and the knob for each:

- **No TypeScript compile at boot.** The root `npm start` used to run
  `migrate:api` first, which type-checks the whole API through `ts-node`
  on every start — 1.4 GB and ~25 s even with nothing to migrate.
  Migrations are applied by the API itself as it boots (`migrationsRun`
  in `app.module.ts`, from the compiled `dist/database/migrations`), so
  that step was pure overhead. `npm run migrate:api` still exists for
  running them by hand.
- **Heap ceilings** (`api/scripts/start-prod.sh`,
  `web/scripts/start-prod.sh`). Node sizes its heap from the memory it is
  allowed to use and is slow to collect below that, so both servers used
  to hold 50–100 MB of already-dead objects after any burst of traffic.
  Defaults: 256 MB old space, 8 MB semi-space, for each service. Override
  with `API_MAX_OLD_SPACE_MB` / `WEB_MAX_OLD_SPACE_MB` (and
  `*_MAX_SEMI_SPACE_MB`). The data each server really holds is 55–70 MB,
  so 256 leaves about four times headroom; if either ever logs
  `JavaScript heap out of memory`, raise its ceiling rather than removing
  it.
- **Allocator settings for the API** (`MALLOC_MMAP_THRESHOLD_`,
  `MALLOC_TRIM_THRESHOLD_`, set in `api/scripts/start-prod.sh`). Without
  them, memory used to decode an uploaded photo is kept by glibc instead
  of being returned to the OS — one upload raised the process by ~100 MB
  until the next restart.
- **One photo processed at a time** (`uploads/image-processing.ts`), with
  libvips' operation cache off and a 64-megapixel input limit. Trade-off:
  four photos uploaded simultaneously now finish over ~3 s instead of ~1 s.
- **Next.js** (`web/next.config.js`): `cacheMaxMemorySize: 0` (prerendered
  pages are served from disk rather than also being held in a 50 MB
  in-memory cache) and `experimental.preloadEntriesOnStart: false` (route
  code is loaded on first use, not all ~150 routes at boot).
- **Optional SDKs load only when configured**: Sentry without a
  `SENTRY_DSN`, and the AWS SDK without `STORAGE_DRIVER=s3`, are no longer
  loaded at all (about 6 MB each).

Two things only the Railway dashboard can change:

1. **Start Commands without `npm`.** Each `npm run ...` wrapper stays
   alive beside the server for as long as it runs (~25–30 MB each). Set
   each service's Custom Start Command (service Settings) to:
   - `api`: `sh api/scripts/start-prod.sh`
   - `web`: `sh web/scripts/start-prod.sh -p $PORT`
2. **Resource limits.** Each service's settings let you cap its memory;
   with the ceilings above, 512 MB per service is comfortable and
   turns any future runaway into a visible restart instead of a larger
   bill.

Still open (not changed here, listed so they aren't a surprise):

- **Video uploads are buffered whole, twice.** A 50 MB video is held in
  memory by the web server (the `/api` rewrite buffers request bodies, see
  `proxyClientMaxBodySize`) and again by the API (`multer` memory storage)
  for the duration of the upload — roughly 110 MB per concurrent video.
  With the allocator settings above it is released afterwards, but the
  real fix is uploading straight to object storage with a presigned URL.
- **Several list endpoints have no page size**, mostly admin queues and
  per-owner lists (`admin.service.ts`, `admin-content.service.ts`,
  message threads). They are small today and grow with the tables behind
  them.

## CI

`.github/workflows/ci.yml` runs lint/build/unit/e2e for both packages
against a real Postgres service container on every push/PR to `main` — see
the root `README.md`'s CI section. Green CI is a floor, not a substitute
for anything above; none of this checklist is enforced by CI.
