import {
  BadRequestException,
  Controller,
  Inject,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { randomUUID } from "crypto";
import { Throttle, seconds } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ImageTooSmallError, processUploadedImage } from "./image-processing";
import {
  ALLOWED_VIDEO_MIME_TYPES,
  assertSupportedVideo,
  MAX_VIDEO_FILE_SIZE_BYTES,
  videoExtensionForMime,
} from "./video-validation";
import { extractVideoThumbnail } from "./video-thumbnail";
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from "./storage/storage-provider.interface";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
// Raw upload cap, before re-encoding shrinks it further (see
// image-processing.ts) — generous enough for an unedited phone photo.
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_MESSAGE_MEDIA_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-m4a",
];
function isAllowedAudioMimeType(mimeType: string) {
  return (
    ALLOWED_AUDIO_MIME_TYPES.includes(mimeType) ||
    mimeType.startsWith("audio/webm") ||
    mimeType.startsWith("audio/ogg")
  );
}

/**
 * Photo upload for reviews/business/place listings. Every upload is
 * re-encoded through `processUploadedImage` (EXIF stripped, resized,
 * recompressed into a full + thumbnail rendition) before both are handed
 * to whichever `StorageProvider` `STORAGE_DRIVER` selects (`StorageModule`)
 * — local disk by default, S3-compatible object storage with
 * `STORAGE_DRIVER=s3`.
 */
@ApiTags("Uploads")
@Controller("uploads")
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  @Post("image")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  // A listing owner uploading a full photo set, or an admin batch-editing
  // the catalog, can legitimately fire off a dozen-plus of these in a
  // row — well above login/password's 5/min, but still a real ceiling
  // against storage-filling abuse off a stolen token.
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @UseInterceptors(
    FileInterceptor("file", {
      // Buffered in memory, not streamed to disk — processUploadedImage
      // needs the whole file to re-encode it, and disk storage would mean
      // writing the *original* (unprocessed, EXIF-and-all) file to disk
      // first for no benefit.
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              "Only JPEG, PNG, WebP, or GIF images are allowed",
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded (expected multipart field "file")',
      );
    }

    let processed;
    try {
      processed = await processUploadedImage(file.buffer);
    } catch (err) {
      if (err instanceof ImageTooSmallError) {
        throw new BadRequestException(err.message);
      }
      // fileFilter only trusts the declared MIME type header — this is
      // the backstop for a file whose actual bytes aren't a real image.
      throw new BadRequestException(
        "Could not process that image — the file may be corrupted or isn't a real image.",
      );
    }

    // Same UUID base for both files (`<id>.jpg` / `<id>-thumb.jpg`) so the
    // frontend can derive the thumbnail's URL from the full URL by
    // filename convention alone (see web/src/lib/images.ts's
    // resolveThumbUrl) — every entity/DTO that stores an uploaded image
    // still only stores the one `url` this endpoint returns.
    const id = randomUUID();
    const filename = `${id}.${processed.full.extension}`;
    const thumbFilename = `${id}-thumb.${processed.thumb.extension}`;

    const [{ url }] = await Promise.all([
      this.storage.save({
        buffer: processed.full.buffer,
        filename,
        contentType: processed.full.contentType,
      }),
      // Best-effort: a thumbnail is a bandwidth optimization, not a
      // correctness requirement — SafeImage's thumbSrc falls back to the
      // full-size image on a load error, so a failure here shouldn't fail
      // the whole upload.
      this.storage
        .save({
          buffer: processed.thumb.buffer,
          filename: thumbFilename,
          contentType: processed.thumb.contentType,
        })
        .catch((err) => {
          this.logger.warn(
            `Failed to save thumbnail for ${filename}: ${err instanceof Error ? err.message : err}`,
          );
        }),
    ]);
    return { url };
  }

  @Post("message-media")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: seconds(60) } })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_MESSAGE_MEDIA_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        const supported =
          ALLOWED_MIME_TYPES.includes(file.mimetype) ||
          ALLOWED_VIDEO_MIME_TYPES.includes(
            file.mimetype as (typeof ALLOWED_VIDEO_MIME_TYPES)[number],
          ) ||
          isAllowedAudioMimeType(file.mimetype);
        if (!supported) {
          callback(
            new BadRequestException(
              "Only images, MP4/WebM videos, or browser-compatible audio are allowed",
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadMessageMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded (expected multipart field "file")',
      );
    }
    const id = randomUUID();
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      let processed;
      try {
        processed = await processUploadedImage(file.buffer);
      } catch (err) {
        if (err instanceof ImageTooSmallError) {
          throw new BadRequestException(err.message);
        }
        throw new BadRequestException("Could not process that image");
      }
      const filename = `messages/${id}.${processed.full.extension}`;
      const thumbFilename = `messages/${id}-thumb.${processed.thumb.extension}`;
      const [{ url }] = await Promise.all([
        this.storage.save({
          buffer: processed.full.buffer,
          filename,
          contentType: processed.full.contentType,
        }),
        this.storage.save({
          buffer: processed.thumb.buffer,
          filename: thumbFilename,
          contentType: processed.thumb.contentType,
        }),
      ]);
      return {
        url,
        thumbnailUrl: url.replace(
          `.${processed.full.extension}`,
          `-thumb.${processed.thumb.extension}`,
        ),
        contentType: processed.full.contentType,
        kind: "image",
        size: file.size,
      };
    }
    if (
      ALLOWED_VIDEO_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_VIDEO_MIME_TYPES)[number],
      )
    ) {
      assertSupportedVideo(file);
      const filename = `messages/${id}.${videoExtensionForMime(file.mimetype)}`;
      const { url } = await this.storage.save({
        buffer: file.buffer,
        filename,
        contentType: file.mimetype,
      });
      let thumbnailUrl: string | null = null;
      try {
        const thumbnail = await extractVideoThumbnail(file.buffer);
        thumbnailUrl = (
          await this.storage.save({
            buffer: thumbnail,
            filename: `messages/${id}-poster.jpg`,
            contentType: "image/jpeg",
          })
        ).url;
      } catch (error) {
        this.logger.warn(
          `Could not generate message video poster for ${filename}: ${error instanceof Error ? error.message : error}`,
        );
      }
      return {
        url,
        thumbnailUrl,
        contentType: file.mimetype,
        kind: "video",
        size: file.size,
      };
    }
    const audioExtensions: Record<string, string> = {
      "audio/webm": "webm",
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/wav": "wav",
      "audio/x-m4a": "m4a",
    };
    const audioMimeType = file.mimetype.split(";", 1)[0];
    const filename = `messages/${id}.${audioExtensions[audioMimeType] ?? "audio"}`;
    const { url } = await this.storage.save({
      buffer: file.buffer,
      filename,
      contentType: file.mimetype,
    });
    return {
      url,
      thumbnailUrl: null,
      contentType: file.mimetype,
      kind: "audio",
      size: file.size,
    };
  }

  @Post("video")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MAX_VIDEO_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (
          !ALLOWED_VIDEO_MIME_TYPES.includes(
            file.mimetype as (typeof ALLOWED_VIDEO_MIME_TYPES)[number],
          )
        ) {
          callback(
            new BadRequestException(
              "Only MP4, WebM, QuickTime, or Ogg videos are allowed",
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    assertSupportedVideo(file);
    const id = randomUUID();
    const filename = `${id}.${videoExtensionForMime(file.mimetype)}`;
    const { url } = await this.storage.save({
      buffer: file.buffer,
      filename,
      contentType: file.mimetype,
    });
    let thumbnailUrl: string | null = null;
    try {
      const thumbnail = await extractVideoThumbnail(file.buffer);
      const result = await this.storage.save({
        buffer: thumbnail,
        filename: `${id}-poster.jpg`,
        contentType: "image/jpeg",
      });
      thumbnailUrl = result.url;
    } catch (error) {
      this.logger.warn(
        `Could not generate video poster for ${filename}: ${error instanceof Error ? error.message : error}`,
      );
    }
    return { url, thumbnailUrl };
  }
}
