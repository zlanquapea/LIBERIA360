import sharp from "sharp";

const MAX_DIMENSION_PX = 2000;
const JPEG_QUALITY = 82;

export interface ProcessedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

/**
 * Normalizes every upload to a resized, EXIF-stripped JPEG before it's
 * stored — three problems solved at once:
 *
 * 1. EXIF can carry GPS coordinates and other metadata a business owner
 *    never meant to publish alongside a listing photo. Calling `.rotate()`
 *    with no arguments auto-orients the pixels using the recorded EXIF
 *    orientation *before* it's dropped; re-encoding with `.jpeg()` (and
 *    never calling `withMetadata()`) then emits a clean file with no EXIF
 *    block at all.
 * 2. Phone photos routinely arrive at 10+ MB / 4000px+ — far more than a
 *    listing gallery ever displays at. Capping the long edge at 2000px and
 *    re-encoding at quality 82 cuts storage and bandwidth substantially
 *    with no visible loss at gallery/hero sizes. `withoutEnlargement` means
 *    a small source image is never upscaled.
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
  const output = await sharp(buffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION_PX,
      height: MAX_DIMENSION_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { buffer: output, contentType: "image/jpeg", extension: "jpg" };
}
