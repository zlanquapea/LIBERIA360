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

## Notes

- Phase 1 has no PostGIS dependency — `latitude`/`longitude` are plain columns. "Near Me" radius search (Phase 2) is the point at which PostGIS earns its setup cost; until then, distance sorting can be done with a Haversine expression in SQL.
