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

/**
 * What `UploadsController` writes a processed image through — either
 * `LocalStorageProvider` (dev/demo default) or `S3StorageProvider`
 * (`STORAGE_DRIVER=s3`; see `StorageModule` for the selection). Keeping
 * this interface tiny (one method) is deliberate: uploads are always a
 * single already-processed buffer with a pre-chosen filename by the time
 * they reach a provider, so there's nothing provider-specific to leak into
 * the controller either way.
 */
export interface StorageProvider {
  save(input: SaveFileInput): Promise<SaveFileResult>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
