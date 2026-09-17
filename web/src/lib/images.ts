import { absoluteUrl } from "./site";

// POST /uploads/image (api/src/uploads/uploads.controller.ts) returns a
// path relative to the *API* origin — e.g. "/uploads/<uuid>.jpg" — served
// by the Nest app itself, not under /api/v1 and not on the web app's own
// origin. Anywhere an uploaded image is rendered needs the full URL built
// from that origin, not the page's own origin.
//
// An admin can also just paste an external https:// URL (stock photography,
// a business's own CDN) straight into a photo field — those are passed
// through untouched.

// Local uploads are exposed through the same-origin reverse proxy.
const API_ORIGIN = "";

export function resolveImageUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Open Graph/Twitter Card images must be a fetchable http(s) URL — a link
 * pasted into Facebook/WhatsApp/X has no page origin of its own to resolve
 * a relative one against (unlike a normal <img src>), and those crawlers
 * reject a `data:` URI outright rather than rendering it. Reuses
 * resolveImageUrl's own same-origin-vs-external distinction, then anchors
 * the same-origin case to this app's canonical SITE_URL (see lib/site.ts's
 * own doc comment on why that constant exists, and structured-data.ts's
 * absoluteUrl() for the equivalent JSON-LD case). Returns null for a
 * `data:` URI (some seed/placeholder photos use these) since there's no
 * URL to hand a crawler — callers should fall back to the site default.
 */
export function absoluteImageUrl(path: string): string | null {
  const resolved = resolveImageUrl(path);
  if (resolved.startsWith("data:")) return null;
  return /^https?:\/\//i.test(resolved) ? resolved : absoluteUrl(resolved);
}

// Matches the filename this app's own upload pipeline writes — a random
// UUID plus `.jpg` (see api/src/uploads/uploads.controller.ts) — at the end
// of a URL, ignoring any query string. Used to tell "one of our own
// uploads" apart from an admin-pasted external stock-photo URL, which has
// no thumbnail sibling to derive.
const OWN_UPLOAD_FILENAME =
  /\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jpg(?:[?#].*)?$/i;

/**
 * Every image this app's own upload pipeline stores is saved as two
 * files sharing one UUID: the full-size rendition at `<uuid>.jpg` and a
 * small pre-shrunk `<uuid>-thumb.jpg` right alongside it (see
 * `UploadsController.uploadImage`) — cards/grids (PlaceCard, BusinessCard,
 * CreatorCard, gallery grid cells, ...) should load the thumbnail, not the
 * full photo, since dozens of them can appear on one page.
 *
 * Derived from the full URL by filename convention rather than plumbing a
 * second URL through every entity/DTO/type that stores an image path.
 * Returns null for anything that isn't one of our own uploads (an external
 * URL, a data: URI) — those have no thumbnail, so the caller should just
 * render the full-size image (SafeImage's `thumbSrc` prop already falls
 * back to `src` when this is null, or when the thumbnail 404s).
 */
export function resolveThumbUrl(path: string): string | null {
  const full = resolveImageUrl(path);
  const match = full.match(OWN_UPLOAD_FILENAME);
  if (!match) return null;
  return full.slice(0, match.index) + `/${match[1]}-thumb.jpg`;
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
