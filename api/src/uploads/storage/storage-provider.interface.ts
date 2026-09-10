export interface SaveFileInput {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface SaveFileResult {
  // Absolute (S3) or root-relative (local disk) URL the file is reachable
  // at — callers (UploadsController) don't need to know which.
  url: string;
}

export interface SavePrivateFileResult {
  // Opaque key the same provider's readPrivate() can turn back into bytes
  // — never a URL, and never meant to be handed to a client directly: local
  // disk writes it outside the statically-served uploads dir, and S3 writes
  // it without assuming (or needing) the bucket to be publicly readable.
  key: string;
}

export interface ReadPrivateFileResult {
  buffer: Buffer;
}

/**
 * What `UploadsController` writes a processed image through — either
 * `LocalStorageProvider` (dev/demo default) or `S3StorageProvider`
 * (`STORAGE_DRIVER=s3`; see `StorageModule` for the selection). `save()`
 * covers that case: a single already-processed buffer with a pre-chosen
 * filename, meant to be publicly reachable at the URL it returns.
 *
 * `savePrivate()`/`readPrivate()` are for the opposite case — content that
 * must stay unreachable without an application-level authorization check
 * (see PharmaciesService's prescription uploads, the only current caller).
 * There is deliberately no "private URL" — a URL is something a client can
 * fetch directly, which is exactly what a private file must not allow — so
 * a caller always reads private bytes back through this same interface and
 * decides for itself how (or whether) to hand them to a client.
 */
export interface StorageProvider {
  save(input: SaveFileInput): Promise<SaveFileResult>;
  savePrivate(input: SaveFileInput): Promise<SavePrivateFileResult>;
  readPrivate(key: string): Promise<ReadPrivateFileResult>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
