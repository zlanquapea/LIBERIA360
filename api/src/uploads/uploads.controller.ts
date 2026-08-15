import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { randomUUID } from "crypto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Local-disk file upload for review/business photos.
 *
 * DEV/DEMO ONLY: Tech Spec §6.1 calls for S3-compatible object storage + a
 * CDN in production. This stores to a local `uploads/` folder and serves it
 * statically (wired up in main.ts) — fine for local dev and this demo, not
 * for a real deployment (no redundancy, doesn't survive a redeploy, and
 * won't work at all across multiple server instances).
 */
@Controller("uploads")
export class UploadsController {
  @Post("image")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: join(__dirname, "..", "..", "uploads"),
        filename: (_req, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
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
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded (expected multipart field "file")',
      );
    }
    return { url: `/uploads/${file.filename}` };
  }
}
