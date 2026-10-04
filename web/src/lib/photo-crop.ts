// Crop maths for the pre-upload photo editor (components/PhotoEditor).
// Coordinates are in the rotated source image's pixels.

export type AspectId = 'original' | '4:3' | '16:9' | '1:1';
export type Rotation = 0 | 90 | 180 | 270;

export const ASPECTS: Record<Exclude<AspectId, 'original'>, number> = {
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '1:1': 1,
};

export const MAX_ZOOM = 3;

export interface CropState {
  rotation: Rotation;
  aspect: AspectId;
  zoom: number;
  // Crop centre, in rotated-image pixels.
  cx: number;
  cy: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function rotatedSize(width: number, height: number, rotation: Rotation): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}

/** The crop rectangle for a state: the largest frame of the chosen aspect
 * that fits the image, shrunk by the zoom, centred on (cx, cy) and kept
 * inside the image. */
export function cropRect(imgW: number, imgH: number, state: CropState): CropRect {
  const { width: rw, height: rh } = rotatedSize(imgW, imgH, state.rotation);
  const aspect = state.aspect === 'original' ? rw / rh : ASPECTS[state.aspect];
  let width = rw;
  let height = rw / aspect;
  if (height > rh) {
    height = rh;
    width = rh * aspect;
  }
  const zoom = Math.min(MAX_ZOOM, Math.max(1, state.zoom));
  width /= zoom;
  height /= zoom;
  const cx = clamp(state.cx, width / 2, rw - width / 2);
  const cy = clamp(state.cy, height / 2, rh - height / 2);
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** A centred, unzoomed state for an image. */
export function initialCrop(imgW: number, imgH: number, aspect: AspectId = 'original', rotation: Rotation = 0): CropState {
  const { width, height } = rotatedSize(imgW, imgH, rotation);
  return { rotation, aspect, zoom: 1, cx: width / 2, cy: height / 2 };
}

/** True when the state would produce the original image unchanged. */
export function isUnchanged(state: CropState): boolean {
  return state.rotation === 0 && state.aspect === 'original' && state.zoom <= 1;
}

/** Output size for a crop, capped so the long edge is at most `maxEdge`. */
export function outputSize(rect: CropRect, maxEdge = 2400): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(rect.width, rect.height));
  return { width: Math.round(rect.width * scale), height: Math.round(rect.height * scale) };
}

/** Draws the cropped, rotated image onto a canvas context sized w×h. */
export function drawCrop(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  state: CropState,
  w: number,
  h: number,
): void {
  const rect = cropRect(img.width, img.height, state);
  const { width: rw, height: rh } = rotatedSize(img.width, img.height, state.rotation);
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / rect.width, h / rect.height);
  ctx.translate(-(rect.x + rect.width / 2 - rw / 2), -(rect.y + rect.height / 2 - rh / 2));
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
