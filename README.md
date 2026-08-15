# LIBERIA360
LIBERIA360 is a private-sector digital discovery platform for Liberia's tourism and hospitality economy. It gives Liberians, the diaspora, expats, and international visitors one place to discover destinations, plan trips, and connect directly with hotels, restaurants, tour operators, and local creators.

Product context lives in [`LIBERIA360_Business_Plan.docx`](./LIBERIA360_Business_Plan.docx) and [`LIBERIA360_Technical_Specification.docx`](./LIBERIA360_Technical_Specification.docx).

## Repository layout

This is an npm-workspaces monorepo:

```
api/   NestJS backend — REST API, PostgreSQL (TypeORM)
web/   Next.js frontend — responsive PWA
```

See `api/README.md` and `web/README.md` for service-specific setup (including each phase's feature list in more detail), and the "Local development" section below for running the full stack.

## Scope

**Phase 1** (Tech Spec §3.1 — discovery, no accounts/payments): catalog of places/categories/counties/activities, seeded with Stage 1 (Greater Monrovia) sample data; Home, Explore (map), Category Browse, County Browse, Search, Destination Profile, and Saved/Bucket List (device-local) screens; the REST API backing all of it.

**Phase 2** (Tech Spec §3.2 — accounts and everything that depends on them): JWT auth; reviews + rating recalculation; business self-claim; creator directory/profiles; events (with push notifications for events in a user's home county); "Near Me" radius search; "Build My Liberia Trip" + Weekend Explorer itinerary generation; push notification opt-in. All backend modules and their frontend screens are built and tested — see `api/README.md`'s and `web/README.md`'s "Phase 2" sections for the module-by-module breakdown.

**Phase 3** (Tech Spec §3.3 / Business Plan §8 — the marketplace layer): request-to-book bookings (hotel/tour/restaurant/transport, one entity for all four) with MTN Mobile Money as the schema-ready-but-not-yet-wired-up payment provider; a per-business analytics dashboard (views/saves/contact-clicks/booking-requests); time-boxed "Featured this week" sponsored placements and featured creators; and a net-new admin dashboard (verification/moderation, content management, sponsored-placement management, B2B aggregate tourism analytics), gated on a manually-promoted `User.isAdmin` flag. See `api/README.md`'s and `web/README.md`'s "Phase 3" sections for the module-by-module breakdown, including how to grant admin access.

What's deliberately **not** here yet: real payment capture (a live MTN MoMo merchant integration is a follow-up this environment can't create credentials for) and a self-service external-stakeholder account system for the B2B analytics product (surfaced through the admin dashboard instead — see the Technical Specification for the full phased plan).

## Local development

Requires Node 20+, PostgreSQL, and npm.

### 1. Install dependencies

```bash
npm install    # installs both workspaces from the repo root
```

### 2. Set up PostgreSQL

**macOS / a machine with PostgreSQL already installed and `sudo -u postgres` working normally:**

```bash
sudo -u postgres createuser liberia360 --pwprompt   # password: liberia360
sudo -u postgres createdb liberia360 -O liberia360
```

**GitHub Codespaces** (the default image doesn't ship PostgreSQL, and `sudo -u <user>` for a target other than root can prompt for a password it won't accept — use this exact sequence, confirmed working):

```bash
# Install and start PostgreSQL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start

# Create the role and database as the postgres OS user, via a root shell
# (sudo -u postgres directly can hang on a password prompt in Codespaces —
# going through `sudo su -` avoids that)
sudo su - postgres -c "psql -c \"CREATE ROLE liberia360 WITH LOGIN PASSWORD 'liberia360';\""
sudo su - postgres -c "createdb liberia360 -O liberia360"
```

PostgreSQL doesn't auto-start when a Codespace stops/resumes — if a fresh session can't reach the DB, just re-run `sudo service postgresql start`.

**Either way, verify the connection the app will actually use before moving on:**

```bash
PGPASSWORD=liberia360 psql -h 127.0.0.1 -p 5432 -U liberia360 -d liberia360 -c "SELECT 1;"
```

That should print `1`. If it doesn't, fix that before continuing — migrations/seeding will fail with the same error.

### 3. Configure and load the app

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env.local

npm run migrate:api                            # apply schema
npm run seed:api                               # load Stage 1 sample data
```

### 4. Run it

```bash
npm run dev:api                                # terminal 1 — http://localhost:3001
npm run dev:web                                # terminal 2 — http://localhost:3000
```

Open http://localhost:3000 — Home, Explore, Counties, Search, and a Destination Profile should all load with real seeded data. (In Codespaces, use the **Ports** tab to open the forwarded URL for port 3000 rather than typing `localhost` into a browser outside the Codespace.)

Root `package.json` also exposes `build:api`, `build:web`, `test:api`, and `lint:api`/`lint:web` for CI-style checks; see `web/package.json` for the frontend's own `lint`/`build` scripts.

### Codespaces: one more step before signup/login (and anything else Phase 2 or 3) will work

Phase 1's pages fetch data from the Next.js **server**, which runs inside the Codespace container — `http://localhost:3001` correctly reaches the API from there, so Home/Explore/Search/etc. work with `web/.env.example`'s defaults untouched.

Phase 2's auth and every write (signup, login, reviews, business claims, posting an event, ...) — and everything in Phase 3 that follows the same pattern (booking requests, analytics events, the whole admin dashboard) — run **client-side**, in your actual browser, after the page has already loaded. Your browser is *not* inside the container, so a client-side `fetch('http://localhost:3001/...')` asks **your own machine's** port 3001 — not the Codespace's — and fails outright. Symptom: every such form (starting with signup) fails with a generic "Something went wrong" no matter what you enter.

Fix, once both dev servers are running:

1. **Ports** tab → find port `3001` → right-click → **Port Visibility** → **Public**.
2. Copy its forwarded URL (`https://<something>-3001.app.github.dev`).
3. `web/.env.local`: set `NEXT_PUBLIC_API_URL` to that URL + `/api/v1`.
4. `api/.env`: set `CORS_ORIGIN` to your forwarded **port 3000** URL (same pattern).
5. Restart `npm run dev:api` and `npm run dev:web` so they pick up the new env vars.
