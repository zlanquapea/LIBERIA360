// Canonical site origin, for anything that needs an absolute URL (SEO
// structured data, Open Graph tags) rather than a relative path — schema.org
// JSON-LD's `url` field isn't valid as a relative path.
//
// Dev-only fallback so a fresh checkout works without extra setup, same
// pattern as api's JWT_SECRET/TWO_FACTOR_ENCRYPTION_KEY placeholders — set
// a real NEXT_PUBLIC_SITE_URL once this has a real domain.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://liberia360.example').replace(/\/$/, '');

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
