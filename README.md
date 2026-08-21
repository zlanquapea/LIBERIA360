# LIBERIA360

[![CI](https://github.com/zlanquapea/LIBERIA360/actions/workflows/ci.yml/badge.svg)](https://github.com/zlanquapea/LIBERIA360/actions/workflows/ci.yml)

A digital discovery and booking platform for Liberia's tourism and hospitality sector. LIBERIA360 gives travelers — Liberians, the diaspora, expats, and international visitors — a single place to discover destinations, plan trips, and connect directly with hotels, restaurants, tour operators, and local creators.

Product documentation: [`LIBERIA360_Business_Plan.docx`](./LIBERIA360_Business_Plan.docx), [`LIBERIA360_Technical_Specification.docx`](./LIBERIA360_Technical_Specification.docx).

## Architecture

```
api/                     NestJS REST API — PostgreSQL, TypeORM, JWT auth
web/                     Next.js (App Router) frontend — responsive PWA
packages/shared-types/   TypeScript types shared between api/ and web/
```

npm workspaces monorepo. `api/` and `web/` are independently deployable services that communicate over HTTP; `packages/shared-types` is a types-only package with no runtime code or build step — its `package.json` `types` field points directly at TypeScript source.

Component-level documentation: [`api/README.md`](./api/README.md), [`web/README.md`](./web/README.md). Production deployment: [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Feature set

| Area | Capabilities |
|---|---|
| Catalog | Places, categories, counties, activities; full-text search; filtering and sorting; radius ("Near Me") search |
| Accounts | JWT auth, email verification, password reset, two-factor authentication (TOTP), session revocation, account deletion |
| Content | Reviews with rating aggregation (places and creators), business self-claim and management, business-authored posts (offers, announcements, articles, travel tips, experiences — review-gated before going public), creator profiles, events |
| Trip planning | AI-assisted itinerary generation ("Build My Liberia Trip", Weekend Explorer), collaborative multi-user trip editing |
| Marketplace | Request-to-book bookings for businesses and creators, in-booking messaging, business/creator analytics dashboards, sponsored placements, featured creators |
| Admin | Content moderation, verification workflows, crowdsourced freshness reporting, B2B aggregate analytics, audit log |
| Platform | Progressive Web App (offline saved places, push notifications), SEO structured data, crash reporting |

Not yet implemented: live payment capture (Bookings are request-to-book only; MTN Mobile Money is schema-ready but not integrated) and a self-service external-stakeholder account system for the B2B analytics product.

## Requirements

- Node.js 20+
- PostgreSQL 14+
- npm

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Provision PostgreSQL

```bash
sudo -u postgres createuser liberia360 --pwprompt   # password: liberia360
sudo -u postgres createdb liberia360 -O liberia360
```

**GitHub Codespaces** (no PostgreSQL preinstalled):

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start

sudo su - postgres -c "psql -c \"CREATE ROLE liberia360 WITH LOGIN PASSWORD 'liberia360';\""
sudo su - postgres -c "createdb liberia360 -O liberia360"
```

PostgreSQL does not persist across a Codespace stop/resume — run `sudo service postgresql start` again if a session can't reach the database.

Verify connectivity:

```bash
PGPASSWORD=liberia360 psql -h 127.0.0.1 -p 5432 -U liberia360 -d liberia360 -c "SELECT 1;"
```

### 3. Configure environment

```bash
cp api/.env.example api/.env
cp web/.env.example web/.env.local
```

### 4. Apply schema and seed data

```bash
npm run migrate:api
npm run seed:api
```

### 5. Run

```bash
npm run dev:api    # terminal 1 — http://localhost:3001
npm run dev:web    # terminal 2 — http://localhost:3000
```

Open http://localhost:3000. In Codespaces, use the **Ports** tab to open the forwarded URL for port 3000.

### Codespaces: exposing the API for client-side requests

Server-rendered pages fetch data from within the container, so `http://localhost:3001` works for them without changes. Client-side requests (auth, form submissions, and everything gated behind login) run in the browser, which is outside the container — a client-side call to `localhost:3001` reaches the local machine's port 3001, not the Codespace's, and fails.

To fix, with both dev servers running:

1. **Ports** tab → port `3001` → right-click → **Port Visibility** → **Public**.
2. Copy its forwarded URL.
3. `web/.env.local`: set `NEXT_PUBLIC_API_URL` to `<forwarded-url>/api/v1`.
4. `api/.env`: set `CORS_ORIGIN` to the forwarded URL for port 3000.
5. Restart both dev servers.

## Scripts

Run from the repository root:

| Script | Description |
|---|---|
| `npm run dev:api` / `dev:web` | Start each service in watch mode |
| `npm run build:api` / `build:web` | Production build |
| `npm run test:api` / `test:web` | Unit tests |
| `npm run lint:api` / `lint:web` | Lint |
| `npm run migrate:api` | Apply database migrations |
| `npm run seed:api` | Load sample catalog data |

See [`api/README.md`](./api/README.md) and [`web/README.md`](./web/README.md) for each workspace's full script list, including e2e tests.

## CI

`.github/workflows/ci.yml` runs on every push/PR to `main` against a real PostgreSQL 16 service container.

- **`api`**: lint, build, unit tests, then e2e tests against a disposable `liberia360_test` database.
- **`web`**: builds and seeds the API, starts it, then runs lint, type-checking, unit tests, a production `next build` (which statically prerenders several pages against the live API), and a Playwright e2e suite against that same live API + database.
