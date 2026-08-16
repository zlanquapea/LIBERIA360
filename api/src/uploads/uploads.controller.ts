import {
  BadRequestException,
  Controller,
  Inject,
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
import { processUploadedImage } from "./image-processing";
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

/**
 * Photo upload for reviews/business/place listings. Every upload is
 * re-encoded through `processUploadedImage` (EXIF stripped, resized,
 * recompressed) before it's handed to whichever `StorageProvider`
 * `STORAGE_DRIVER` selects (`StorageModule`) — local disk by default,
 * S3-compatible object storage with `STORAGE_DRIVER=s3`.
 */
@ApiTags("Uploads")
@Controller("uploads")
export class UploadsController {
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
    } catch {
      // fileFilter only trusts the declared MIME type header — this is
      // the backstop for a file whose actual bytes aren't a real image.
      throw new BadRequestException(
        "Could not process that image — the file may be corrupted or isn't a real image.",
      );
    }

    const filename = `${randomUUID()}.${processed.extension}`;
    const { url } = await this.storage.save({
      buffer: processed.buffer,
      filename,
      contentType: processed.contentType,
    });
    return { url };
  }
}
