import sharp, { type Sharp } from "sharp";

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
const THUMB_DIMENSION_PX = 640;
// Card renditions keep the photo's orientation but no wider than 4:3 (or
// taller than 3:4): cards are roughly that shape, so a panorama or tall
// screenshot is trimmed here around its most interesting region (sharp's
// "attention" strategy) instead of being center-cropped by the browser,
// which tends to cut off the subject. Ordinary phone photos (4:3, 3:4)
// pass through uncropped.
const MAX_CARD_ASPECT = 4 / 3;
const MIN_CARD_ASPECT = 3 / 4;
// Below this on either edge, a listing photo isn't useful for a gallery/hero
// display and is more likely a broken/placeholder/tracking-pixel upload than
// a real photo — reject it rather than silently store a 1x1px "image".
const MIN_DIMENSION_PX = 200;
const JPEG_QUALITY = 78;
// More aggressive than the full rendition's quality — safe because a small
// on-screen size hides compression artifacts a full-size render wouldn't.
const THUMB_JPEG_QUALITY = 70;

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
  // .rotate() doesn't swap the reported dimensions; EXIF orientations 5–8
  // are 90° turns.
  const turned = (metadata.orientation ?? 1) >= 5;
  const width = (turned ? metadata.height : metadata.width) ?? 0;
  const height = (turned ? metadata.width : metadata.height) ?? 0;
  if (width < MIN_DIMENSION_PX || height < MIN_DIMENSION_PX) {
    throw new ImageTooSmallError(width, height);
  }

  // A light, honest finish applied to every photo: exposure and contrast
  // evened out (ignoring the darkest and brightest 1% so a few specks
  // can't skew it), a touch more colour, and resize-aware sharpening. No
  // filters or effects — a place should look like itself, just well shot.
  function finish(pipeline: Sharp): Sharp {
    return pipeline
      .normalise({ lower: 1, upper: 99 })
      .modulate({ saturation: 1.06 })
      .sharpen({ sigma: 0.6 });
  }

  async function encode(
    pipeline: Sharp,
    quality: number,
  ): Promise<ImageRendition> {
    const output = await pipeline
      .jpeg({ quality, mozjpeg: true, progressive: true })
      .toBuffer();
    return { buffer: output, contentType: "image/jpeg", extension: "jpg" };
  }

  // A fresh sharp() per rendition keeps each pipeline independent.
  const full = encode(
    finish(
      sharp(buffer).rotate().resize({
        width: MAX_DIMENSION_PX,
        height: MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      }),
    ),
    JPEG_QUALITY,
  );

  // sharp applies one resize per pipeline, so the attention crop (when
  // needed) runs first on its own, then the card-size resize.
  const crop = cardCrop(width, height);
  const cropped = crop
    ? await sharp(buffer)
        .rotate()
        .resize({
          width: crop.width,
          height: crop.height,
          fit: "cover",
          position: sharp.strategy.attention,
        })
        .toBuffer()
    : null;
  const thumb = encode(
    finish(
      (cropped ? sharp(cropped) : sharp(buffer).rotate()).resize({
        width: THUMB_DIMENSION_PX,
        height: THUMB_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      }),
    ),
    THUMB_JPEG_QUALITY,
  );

  return { full: await full, thumb: await thumb };
}

/** The crop that brings an image within the card aspect range, or null
 * when it's already within it. */
export function cardCrop(
  width: number,
  height: number,
): { width: number; height: number } | null {
  const aspect = width / height;
  if (aspect > MAX_CARD_ASPECT) {
    return { width: Math.round(height * MAX_CARD_ASPECT), height };
  }
  if (aspect < MIN_CARD_ASPECT) {
    return { width, height: Math.round(width / MIN_CARD_ASPECT) };
  }
  return null;
}
