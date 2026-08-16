import { Injectable } from "@nestjs/common";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { localUploadsDir } from "../local-uploads-dir";
import {
  SaveFileInput,
  SaveFileResult,
  StorageProvider,
} from "./storage-provider.interface";

/**
 * Dev/demo default (`STORAGE_DRIVER=local` or unset) — writes to a local
 * `uploads/` folder, served back statically by main.ts. Doesn't survive a
 * redeploy and doesn't work across multiple instances behind a load
 * balancer; `validateProductionConfig` warns (doesn't block) on this being
 * selected with `NODE_ENV=production`. Swap to `S3StorageProvider` via
 * `STORAGE_DRIVER=s3` for anything beyond local dev.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  async save({ buffer, filename }: SaveFileInput): Promise<SaveFileResult> {
    const dir = localUploadsDir();
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), buffer);
    return { url: `/uploads/${filename}` };
  }
}
