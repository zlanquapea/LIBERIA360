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
  own comments for the exact steps.
- **Railway**: no blueprint file — deploy from the dashboard as two services
  from this same repo (one for `api`, one for `web`) plus a one-click Postgres
  plugin, wiring `DB_HOST`/`DB_PORT`/etc. to the Postgres plugin's variables
  via Railway's `${{Postgres.PGHOST}}`-style references. The root
  `package.json`'s `build`/`start` scripts (`npm run build` /
  `npm start`) exist specifically so Railway's zero-config builder
  (Railpack) can auto-detect a start command for the `api` service without
  you having to set one manually — they build and start `api` specifically,
  since a single root script can't serve two different apps. The `web`
  service still needs an explicit custom Start Command set in Railway's UI
  (`npm run start --workspace=web -- -p $PORT`), since it's the second app
  in this repo and root auto-detection can only point at one.

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

You don't have to remember this: `validateProductionConfig` (`api/src/config/validate-production-config.ts`)
runs at boot whenever `NODE_ENV=production` and **refuses to start** if
either is still the committed dev placeholder — the two failure modes where
booting anyway would be actively dangerous (forgeable login tokens; every
account's TOTP secret decryptable straight out of a DB dump), not just
incomplete.

## 2. Database

- A real PostgreSQL instance, not the throwaway one from local dev. Set
  `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE`.
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
| `web/.env.local` → `NEXT_PUBLIC_API_URL` | the production **API** origin + `/api/v1` |
| `web/.env.local` → `NEXT_PUBLIC_SITE_URL` | the production **web** origin (schema.org JSON-LD's `url` fields need an absolute URL for SEO — falls back to a placeholder otherwise, which is fine pre-launch but shouldn't ship to real search results) |

## 4. Object storage for uploaded photos

`STORAGE_DRIVER=local` (the default) writes to local disk on whichever
instance handled the upload — doesn't survive a redeploy, and a second
instance behind a load balancer can't see files the first one wrote.
`validateProductionConfig` warns (doesn't block boot) if this is still set
in production. Before real users start uploading listing photos:

```bash
STORAGE_DRIVER=s3
S3_BUCKET=...
S3_REGION=...            # "auto" is fine for R2; a real AWS region for S3
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=...          # only for a non-AWS provider (R2, MinIO, ...)
S3_PUBLIC_URL_BASE=...   # a CDN in front of the bucket, or the bucket's own public URL
```

Works with AWS S3, Cloudflare R2, DigitalOcean Spaces, or MinIO. The bucket
needs to actually be publicly readable (or fronted by a CDN that is) —
`S3StorageProvider` deliberately never sets an object ACL, since modern
buckets default to ACLs disabled ("bucket owner enforced").

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

## CI

`.github/workflows/ci.yml` runs lint/build/unit/e2e for both packages
against a real Postgres service container on every push/PR to `main` — see
the root `README.md`'s CI section. Green CI is a floor, not a substitute
for anything above; none of this checklist is enforced by CI.
