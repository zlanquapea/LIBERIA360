// POST /uploads/image (api/src/uploads/uploads.controller.ts) returns a
// path relative to the *API* origin — e.g. "/uploads/<uuid>.jpg" — served
// by the Nest app itself, not under /api/v1 and not on the web app's own
// origin. Anywhere an uploaded image is rendered needs the full URL built
// from that origin, not the page's own origin.
//
// An admin can also just paste an external https:// URL (stock photography,
// a business's own CDN) straight into a photo field — those are passed
// through untouched.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
// NEXT_PUBLIC_API_URL points at .../api/v1 — uploads are served off the
// bare API origin, so strip that suffix to get back to the host.
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

export function resolveImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith('data:')) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** First available photo for a destination — business photos (what the
 * operator actually uploaded: rooms, pool, storefront) take priority over
 * the place's own general photos, since they're usually more specific and
 * more current. */
export function coverImage(
  placeImages: string[] | undefined,
  businessImages: string[] | undefined,
): string | null {
  const first = businessImages?.[0] ?? placeImages?.[0];
  return first ? resolveImageUrl(first) : null;
}

/** Combined, deduped gallery for a destination profile — business photos
 * first (see coverImage), then whatever place photos aren't duplicates. */
export function galleryImages(
  placeImages: string[] | undefined,
  businessImages: string[] | undefined,
): string[] {
  const ordered = [...(businessImages ?? []), ...(placeImages ?? [])];
  return Array.from(new Set(ordered)).map(resolveImageUrl);
}
