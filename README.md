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
 
