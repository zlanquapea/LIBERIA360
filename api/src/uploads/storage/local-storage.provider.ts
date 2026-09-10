import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { mkdir, writeFile } from "fs/promises";
import { dirname, resolve, sep } from "path";
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
    // Every UploadsController caller passes a flat "<uuid>.ext" filename,
    // but a caller can also pass a "<prefix>/<uuid>.ext" key (pharmacies'
    // prescription uploads group theirs under "prescriptions/", the way S3
    // keys naturally do) — create whatever subdirectory that key implies.
    // `filename` is always built from a `randomUUID()` by this app's own
    // callers, never taken verbatim from a client, but `path.join` alone
    // does *not* stop a "../../etc" key from escaping `dir` (it resolves
    // ".." against the preceding segments same as a shell would) — so
    // confirm containment explicitly rather than assume it.
    const destination = resolve(dir, filename);
    if (destination !== dir && !destination.startsWith(dir + sep)) {
      throw new InternalServerErrorException("Invalid storage key");
    }
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    return { url: `/uploads/${filename}` };
  }
}
