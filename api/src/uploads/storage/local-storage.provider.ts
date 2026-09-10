import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve, sep } from "path";
import { localUploadsDir } from "../local-uploads-dir";
import { localPrivateUploadsDir } from "../local-private-uploads-dir";
import {
  ReadPrivateFileResult,
  SaveFileInput,
  SavePrivateFileResult,
  SaveFileResult,
  StorageProvider,
} from "./storage-provider.interface";

// Resolves `filename` (which can be a "<prefix>/<uuid>.ext" key, not just a
// flat name — see save()'s doc comment below) against `dir` and throws
// unless the result stays inside `dir`. Shared by both the public and
// private save/read paths: `path.resolve` alone does *not* stop a
// "../../etc" key from escaping `dir` (it resolves ".." against the
// preceding segments same as a shell would), so this containment check is
// what actually enforces it.
function resolveWithinDir(dir: string, filename: string): string {
  const destination = resolve(dir, filename);
  if (destination !== dir && !destination.startsWith(dir + sep)) {
    throw new InternalServerErrorException("Invalid storage key");
  }
  return destination;
}

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
    const destination = resolveWithinDir(dir, filename);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    return { url: `/uploads/${filename}` };
  }

  // Writes under a directory main.ts never passes to app.useStaticAssets()
  // — unlike save()'s /uploads, nothing here is reachable by URL at all,
  // public or otherwise. Returns the key, not a URL: see the interface's
  // doc comment for why there's no such thing as a "private URL" here.
  async savePrivate({
    buffer,
    filename,
  }: SaveFileInput): Promise<SavePrivateFileResult> {
    const dir = localPrivateUploadsDir();
    const destination = resolveWithinDir(dir, filename);
    const targetDir = dirname(destination);
    // 0700/0600 — this directory holds sensitive files (prescriptions)
    // that must not be world- or group-readable on a shared host,
    // regardless of the process umask. mkdir's own `mode` option is
    // silently masked by umask (a common `0022` leaves directories
    // `0755`), and a recursive mkdir over an already-existing parent
    // doesn't touch that parent's mode at all — chmod'ing explicitly
    // after the fact is what actually enforces this on every call, new
    // directory or not.
    await mkdir(targetDir, { recursive: true });
    await chmod(dir, 0o700);
    await chmod(targetDir, 0o700);
    await writeFile(destination, buffer);
    await chmod(destination, 0o600);
    return { key: filename };
  }

  async readPrivate(key: string): Promise<ReadPrivateFileResult> {
    const dir = localPrivateUploadsDir();
    const source = resolveWithinDir(dir, key);
    const buffer = await readFile(source);
    return { buffer };
  }
}
