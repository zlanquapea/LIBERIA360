# LIBERIA360
LIBERIA360 is a private-sector digital discovery platform for Liberia's tourism and hospitality economy. It gives Liberians, the diaspora, expats, and international visitors one place to discover destinations, plan trips, and connect directly with hotels, restaurants, tour operators, and local creators.

Product context lives in [`LIBERIA360_Business_Plan.docx`](./LIBERIA360_Business_Plan.docx) and [`LIBERIA360_Technical_Specification.docx`](./LIBERIA360_Technical_Specification.docx).

## Repository layout

This is an npm-workspaces monorepo building the Phase 1 MVP (discovery, no accounts/payments):

```
api/   NestJS backend — REST API, PostgreSQL (TypeORM)
web/   Next.js frontend — responsive PWA
```

See `api/README.md` and `web/README.md` for service-specific setup, and the "Local development" section below for running the full stack.

## Phase 1 scope

What's built (matches Tech Spec §3.1 — discovery only, no accounts/payments):

- Catalog: places, categories, counties, activities — seeded with Stage 1 (Greater Monrovia) sample data
- Screens: Home, Explore (map), Category Browse, County Browse, Search, Destination Profile, Saved/Bucket List (device-local)
- REST API backing all of the above, with unit + e2e test coverage

What's deliberately **not** here yet: accounts, reviews, business claims, events, trip planner, "Near Me" radius search (all Phase 2), and bookings/payments (Phase 3). See the Technical Specification for the full phased plan.

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
