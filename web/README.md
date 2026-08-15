# LIBERIA360 Web

Next.js (App Router) responsive PWA — the client described in Tech Spec §6.1. One codebase for mobile, tablet, and desktop.

## Setup

```bash
cp .env.example .env.local   # points at the local API by default
npm install                   # (or from repo root — this is an npm workspace)
```

Requires the API (`../api`) running locally for data — see `../api/README.md`.

## Run

```bash
npm run dev     # http://localhost:3000
```

## Notes

- **PWA**: `public/manifest.webmanifest` + a hand-written `public/sw.js` (app-shell caching, Tech Spec §6.3). The manifest icon (`public/icon.svg`) is a placeholder — swap for real brand icons (including proper maskable-safe-zone PNGs for Android/iOS) before launch.
- **Styling**: Tailwind CSS with a placeholder brand palette in `tailwind.config.ts` — swap once real brand colors are set.
- **API client**: `src/lib/api.ts` wraps `fetch` against `NEXT_PUBLIC_API_URL`. `src/lib/types.ts` mirrors the API's entity shapes by hand; if this grows into a real shared-types package later, that's the file to replace.
