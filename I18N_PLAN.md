# Internationalization (i18n) plan

Status: **approved, not yet started** (Sep 2026). This is the reference for whichever
session picks up implementation — read it before touching any of the phases below.

## Why

LIBERIA360 is a tourism platform. A visitor deciding between destinations reads far
more carefully — and trusts the platform more — in their own language. Product
decision: translate the app's UI for non-English-speaking travelers, starting with
three languages.

## Languages (Phase 1 target)

- **French** — regional lingua franca across West Africa (Guinea, Côte d'Ivoire,
  Senegal, …); the single highest-value addition for cross-border tourism.
- **Chinese (Simplified)** — sizeable Chinese business/investor community and
  growing tourism interest in Liberia.
- **Arabic** — the one language here that also requires RTL layout support (see
  below); a meaningfully bigger lift than French or Chinese.

English remains the default locale.

## Scope for this phase: UI chrome only

Translate: navigation, buttons, form labels, error/empty states, and the copy on
every screen in the core tourist journey — Home, Explore/Search, Place detail, Trip
planner, Events, Businesses/Creators directories, Booking flow, Reviews, Saved
places, and Auth (login/signup/forgot-password).

**Explicitly out of scope / stays English-only** (product decision):
- **Admin dashboard** — internal tool, not tourist-facing.
- **Legal pages** — Privacy Policy and Terms of Service. Legal wording carries real
  risk if a translation drifts from the reviewed English text; these stay
  English-only until/unless the product owner commissions a professional legal
  translation.
- **Dynamic/user-generated content** — place descriptions, business content,
  reviews, blog/help-article bodies. This lives in Postgres, typed in by business
  owners and admins, and translating it is a different, larger problem (machine
  translation with caching + "Translated" disclosure, or a real per-locale
  translations table) — deferred to a later phase, not part of this plan.

## Architecture

- **Library**: [`next-intl`](https://next-intl.dev/) — the standard for Next.js App
  Router; works in both Server and Client Components.
- **Routing**: locale-prefixed URLs with `localePrefix: 'as-needed'`. English
  (default) keeps today's URLs unprefixed (`/places/sapo-national-park`); French/
  Chinese/Arabic get a prefix (`/fr/places/...`, `/zh/...`, `/ar/...`). This avoids
  breaking every existing/indexed link, and each new locale still gets its own
  indexable URL for search engines.
- **Detection**: `next-intl` middleware reads `Accept-Language` on first visit, then
  remembers an explicit choice via cookie (small language switcher in the header).
- **Message files**: JSON per locale under `web/messages/{en,fr,zh,ar}.json`,
  namespaced to match the component tree (`nav`, `home`, `trips`, `places`, `auth`,
  `common`, …) so a given component only pulls its own slice.

## RTL (Arabic)

Arabic isn't just "translate the strings" — the whole layout has to mirror:

- `<html dir="rtl">` when locale is `ar`, driven off the active locale in the root
  layout (`dir="ltr"` otherwise).
- The codebase currently uses **physical** Tailwind utilities everywhere (`ml-*`,
  `pr-*`, `text-left`, `border-l`, `left-*`, …), which don't flip automatically. The
  fix is converting to Tailwind's **logical** utilities (`ms-*`/`me-*`, `ps-*`/`pe-*`,
  `text-start`/`text-end`, `start-*`/`end-*`), which respect `dir` automatically.
  Do this conversion **as each component is touched for translation** (Phases 2–3
  below), not as a second full sweep afterward.
- Font coverage: confirm the current webfont has Arabic glyphs; add a CJK-capable
  fallback for Chinese. Current fonts are almost certainly Latin-only.

French and Chinese are both LTR and don't carry this cost.

## Rollout order

1. **Infra**: install `next-intl`, add the middleware, move routes under
   `app/[locale]/`, wire `dir`/`lang` on the root layout, build a language-switcher
   component. This is a large, mostly-mechanical structural move touching every
   route file — do it as one complete, verified pass (a half-migrated route tree
   doesn't build).
2. **Shell chrome** (highest visibility, lowest file count): Header, BottomNav,
   MobileMenu, footer, shared buttons/dialogs, loading/error states. RTL
   logical-utility conversion starts here.
3. **Core tourist journey**: Home, Explore/Search, Place detail, Trip planner,
   Events, Businesses/Creators directories, Booking flow, Reviews, Saved places.
4. **Auth**: login/signup/forgot-password. (Legal pages — Privacy/Terms — are
   explicitly excluded, see above.)
5. **Test/tooling updates**: Jest render helpers need a `next-intl` mock-message
   provider wrapper; Playwright specs asserting exact English copy need either
   locale-aware assertions or to stay pinned to the default (unprefixed) locale.

## Translation quality

UI chrome strings are short and mostly unambiguous ("Save", "Log in", "No results
found"), so AI-assisted translation is reasonable for a first draft — but a
native-speaker spot-check is expected before calling French/Chinese/Arabic
"launched," especially anywhere in the booking flow where a mistranslation has real
consequences.

## Explicitly deferred (not this phase)

- Admin dashboard translation.
- Legal page translation (Privacy/Terms).
- Dynamic catalog content translation (place/business descriptions, reviews, blog
  and help-article bodies).
- RTL support for anything beyond what Phases 1–4 touch.
