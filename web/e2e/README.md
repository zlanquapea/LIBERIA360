# End-to-end tests

Playwright tests that drive a real browser against the actual API and database — the one place this app verifies a full user flow works, not just a component or endpoint in isolation.

## What's covered

| File | Flow |
|---|---|
| `auth.spec.ts` | Sign up → land on account → log out → log back in; wrong-password error |
| `browse-search.spec.ts` | Home page, search → destination profile, signed-out visitors see no report affordance |
| `review.spec.ts` | Signed-in user posts a review through the real form and sees it appear |
| `booking.spec.ts` | Signed-in guest requests a booking with a claimed business through the real form |
| `admin-moderation.spec.ts` | A review gets reported by 3 independent users (2 via the API, 1 through the real UI), surfaces in the admin moderation queue, and gets removed |

Everything not covered here (2FA, itineraries, business analytics, ...) has unit coverage (`src/**/*.test.tsx`) and, on the API side, its own HTTP-level e2e coverage (`api/test/*.e2e-spec.ts`) — this suite is deliberately scoped to the handful of flows worth a real browser.

## Running

Requires the API running against a real, migrated, seeded database (same as `next build`'s static pages — see the root README's CI section):

```bash
# from the repo root, in a separate terminal
npm run migrate:api
npm run seed:api      # only if the catalog is empty
npm run dev:api
```

Then, from `web/`:

```bash
npm run test:e2e
```

This starts `next dev` itself (see `playwright.config.ts`'s `webServer`) and reuses an already-running one on port 3000 if you have `npm run dev` open in another terminal.

## Design notes

- **Fixtures via the API, not the DB.** `e2e/helpers.ts` registers users and creates reviews/reports through the real API (`request` fixture) rather than touching the database directly — the one exception is `promoteToAdmin`, since granting admin access has no self-service endpoint by design (see `api/README.md`'s Admin section).
- **One worker, always.** These hit a real shared DB/API, not an isolated fixture per test — `playwright.config.ts` sets `workers: 1` (mirroring `api/test/jest-e2e.json`'s `maxWorkers: 1`) so spec files can't race each other's writes or load the server unevenly.
- **Distinct catalog places per spec, sorted by name.** Every spec that needs "a place" asks for a different index (`getPlace(request, N)`) with an explicit `sort=name` — the API's default sort factors in rating, which shifts as tests post reviews, so relying on "the first place" would silently point different specs at different rows over the course of a run.
- **The destination profile page has a short server-side revalidation window** (see the root `web/README.md`'s architecture notes), so a review created via a raw API call moments before navigating isn't guaranteed to show up on the very next render — `admin-moderation.spec.ts` reloads-and-retries past that window instead of assuming immediate consistency the app doesn't actually promise.
- **`loginAs` bypasses the login UI** for specs that aren't themselves testing it, injecting auth state directly into `localStorage`. `auth.spec.ts` is the one place the real signup/login forms get driven end to end.
