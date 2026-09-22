// Canonical site origin, for anything that needs an absolute URL (SEO
// structured data, Open Graph tags) rather than a relative path — schema.org
// JSON-LD's `url` field isn't valid as a relative path.
//
// Dev-only fallback so a fresh checkout works without extra setup, same
// pattern as api's JWT_SECRET/TWO_FACTOR_ENCRYPTION_KEY placeholders — set
// a real NEXT_PUBLIC_SITE_URL once this has a real domain.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://liberia360.net"
).replace(/\/$/, "");

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

// A page-level generateMetadata() that sets its own `openGraph` object
// replaces the root layout's default `openGraph` entirely rather than
// merging into it (Next.js does not deep-merge nested metadata fields
// across segments) — so a place/event/trip/creator with no photo of its
// own would otherwise end up with no og:image at all, worse than the
// site-wide default every other page gets. Callers fall back to this
// explicitly instead of leaving `images` undefined.
export const DEFAULT_OG_IMAGE = absoluteUrl("/logo.png");
