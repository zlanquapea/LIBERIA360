import sharp from "sharp";

// Full/original rendition — hero images, galleries, lightboxes. Trimmed
// down from 2000px: nothing in this app ever displays a photo wider than
// ~1200 CSS px, and 1600px comfortably covers that even on a 2x retina
// screen with no visible loss.
const MAX_DIMENSION_PX = 1600;
// Card/grid rendition (PlaceCard, BusinessCard, CreatorCard, gallery grid
// cells, ...) — those never render an image wider than ~300 CSS px, so
// 480px covers even a 3x pixel-density phone screen. This is the
// highest-leverage size to get right: a listing/search page renders
// dozens of these on one screen, so shipping the *full* rendition to every
// card (as this app did before thumbnails existed) multiplied a
// several-hundred-KB image by every card on the page — by far the
// biggest single contributor to "images take a long time to show up".
const THUMB_DIMENSION_PX = 480;
// Below this on either edge, a listing photo isn't useful for a gallery/hero
// display and is more likely a broken/placeholder/tracking-pixel upload than
// a real photo — reject it rather than silently store a 1x1px "image".
const MIN_DIMENSION_PX = 200;
const JPEG_QUALITY = 78;
// More aggressive than the full rendition's quality — safe because a small
// on-screen size hides compression artifacts a full-size render wouldn't.
const THUMB_JPEG_QUALITY = 68;

export interface ImageRendition {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

export interface ProcessedImage {
  /** Hero/gallery/lightbox rendition — see MAX_DIMENSION_PX. */
  full: ImageRendition;
  /** Card/grid-thumbnail rendition — see THUMB_DIMENSION_PX. */
  thumb: ImageRendition;
}

export class ImageTooSmallError extends Error {
  constructor(width: number, height: number) {
    super(
      `Image is ${width}x${height}px — must be at least ${MIN_DIMENSION_PX}x${MIN_DIMENSION_PX}px.`,
    );
    this.name = "ImageTooSmallError";
  }
}

/**
 * Normalizes every upload to a pair of resized, EXIF-stripped JPEGs before
 * they're stored — three problems solved at once:
 *
 * 1. EXIF can carry GPS coordinates and other metadata a business owner
 *    never meant to publish alongside a listing photo. Calling `.rotate()`
 *    with no arguments auto-orients the pixels using the recorded EXIF
 *    orientation *before* it's dropped; re-encoding with `.jpeg()` (and
 *    never calling `withMetadata()`) then emits a clean file with no EXIF
 *    block at all.
 * 2. Phone photos routinely arrive at 10+ MB / 4000px+ — far more than a
 *    listing ever displays at, whether that's a full hero or a small card
 *    thumbnail. Rendering two purpose-sized outputs (see MAX_DIMENSION_PX /
 *    THUMB_DIMENSION_PX) means a page with dozens of cards on it loads
 *    dozens of small thumbnails instead of dozens of full-size photos.
 *    `withoutEnlargement` means a small source image is never upscaled.
 * 3. One consistent output format means nothing downstream (the frontend,
 *    the storage provider) needs to special-case PNG/WebP/GIF uploads.
 *
 * The one real tradeoff: an animated GIF becomes a static JPEG of its first
 * frame. Acceptable for hotel/place photography — nothing in this app
 * needs an upload to stay an animation.
 */
export async function processUploadedImage(
  buffer: Buffer,
): Promise<ProcessedImage> {
  const metadata = await sharp(buffer).rotate().metadata();
  if (
    (metadata.width ?? 0) < MIN_DIMENSION_PX ||
    (metadata.height ?? 0) < MIN_DIMENSION_PX
  ) {
    throw new ImageTooSmallError(metadata.width ?? 0, metadata.height ?? 0);
  }

  async function render(
    maxDimension: number,
    quality: number,
  ): Promise<ImageRendition> {
    // A fresh sharp() per rendition, not one shared/cloned pipeline — the
    // decode cost of a single already-in-memory image is trivial next to
    // an upload request round-trip, and it keeps each rendition's
    // resize/quality pipeline fully independent (no risk of one output's
    // options leaking into the other's).
    const output = await sharp(buffer)
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer();
    return { buffer: output, contentType: "image/jpeg", extension: "jpg" };
  }

  const [full, thumb] = await Promise.all([
    render(MAX_DIMENSION_PX, JPEG_QUALITY),
    render(THUMB_DIMENSION_PX, THUMB_JPEG_QUALITY),
  ]);

  return { full, thumb };
}
