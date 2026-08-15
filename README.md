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

Requires Node 20+, PostgreSQL, and npm. From the repo root:

```bash
npm install                                    # installs both workspaces

# One-time DB setup (adjust for your local Postgres if not using defaults):
createuser liberia360 --pwprompt               # password: liberia360
createdb liberia360 -O liberia360

cp api/.env.example api/.env
cp web/.env.example web/.env.local

npm run migrate:api                            # apply schema
npm run seed:api                               # load Stage 1 sample data

npm run dev:api                                # terminal 1 — http://localhost:3001
npm run dev:web                                # terminal 2 — http://localhost:3000
```

Then open http://localhost:3000 — Home, Explore, Counties, Search, and a Destination Profile should all load with real seeded data. Root `package.json` also exposes `build:api`, `build:web`, `test:api`, and `lint:api`/`lint:web` for CI-style checks; see `web/package.json` for the frontend's own `lint`/`build` scripts.
