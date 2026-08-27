import { BadRequestException } from "@nestjs/common";

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/ogg",
] as const;

export const MAX_VIDEO_FILE_SIZE_BYTES = 50 * 1024 * 1024;

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/**
 * The upload layer receives an untrusted MIME header. These lightweight
 * container signatures reject renamed images/text files while keeping video
 * processing out of the API process. Playback is still delegated to the
 * browser's native media support.
 */
export function hasSupportedVideoSignature(buffer: Buffer): boolean {
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return true; // WebM/Matroska
  if (startsWithBytes(buffer, [0x4f, 0x67, 0x67, 0x53])) return true; // Ogg

  // ISO Base Media File Format (MP4/MOV/M4V): the `ftyp` box starts at byte 4.
  return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
}

export function assertSupportedVideo(
  file: Express.Multer.File | undefined,
): asserts file is Express.Multer.File {
  if (!file) {
    throw new BadRequestException(
      'No file uploaded (expected multipart field "file")',
    );
  }
  if (
    !ALLOWED_VIDEO_MIME_TYPES.includes(
      file.mimetype as (typeof ALLOWED_VIDEO_MIME_TYPES)[number],
    )
  ) {
    throw new BadRequestException(
      "Only MP4, WebM, QuickTime, or Ogg videos are allowed",
    );
  }
  if (file.buffer.length > MAX_VIDEO_FILE_SIZE_BYTES) {
    throw new BadRequestException("Video is larger than 50MB.");
  }
  if (!hasSupportedVideoSignature(file.buffer)) {
    throw new BadRequestException(
      "That file is not a supported video container or may be corrupted.",
    );
  }
}

export function videoExtensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    case "video/ogg":
      return "ogv";
    default:
      return "mp4";
  }
}
