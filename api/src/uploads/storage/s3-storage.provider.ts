import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { AppConfig } from "../../config/configuration";
import {
  ReadPrivateFileResult,
  SaveFileInput,
  SavePrivateFileResult,
  SaveFileResult,
  StorageProvider,
} from "./storage-provider.interface";

/**
 * `STORAGE_DRIVER=s3` — any S3-compatible provider (AWS S3, Cloudflare R2,
 * DigitalOcean Spaces, MinIO, ...) via `S3_ENDPOINT` for anything that
 * isn't real AWS. Deliberately doesn't set an object ACL: modern S3 buckets
 * (and most S3-compatible providers) default to "bucket owner enforced" /
 * ACLs disabled, where a `PutObjectCommand` ACL fails outright — public
 * read is expected to come from a bucket policy, a CDN in front of the
 * bucket, or the provider's own public-bucket setting instead (see
 * `S3_PUBLIC_URL_BASE`'s doc comment in `.env.example`), not from
 * per-object ACLs.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly privateBucket: string;
  private readonly publicUrlBase: string;

  constructor(configService: ConfigService<AppConfig, true>) {
    const {
      bucket,
      privateBucket,
      region,
      accessKeyId,
      secretAccessKey,
      endpoint,
      publicUrlBase,
    } = configService.get("storage", { infer: true }).s3;
    this.bucket = bucket;
    this.publicUrlBase = publicUrlBase.replace(/\/+$/, "");
    this.client = new S3Client({
      region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      // Path-style addressing (bucket in the URL path, not a subdomain) is
      // what non-AWS S3-compatible endpoints (MinIO, some R2/Spaces setups)
      // expect; real AWS S3 accepts it too, so this is safe either way.
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });

    if (!bucket || !publicUrlBase) {
      this.logger.warn(
        "STORAGE_DRIVER=s3 but S3_BUCKET or S3_PUBLIC_URL_BASE isn't set — uploads will fail. See api/README.md.",
      );
    }
    // Falling back to the public bucket here is a dev/demo convenience
    // only — a key prefix cannot make an object private when the public
    // bucket's own policy already grants public read across every key in
    // it, so anything written through savePrivate()/readPrivate() below
    // would be exactly as exposed as a normal upload despite the prefix.
    if (!privateBucket) {
      this.logger.warn(
        "STORAGE_DRIVER=s3 but S3_PRIVATE_BUCKET isn't set — private uploads (e.g. prescriptions) will be stored in " +
          "S3_BUCKET instead, which is unsafe if that bucket has any public-read policy. Set S3_PRIVATE_BUCKET to a " +
          "bucket with no public access. See api/README.md.",
      );
    }
    this.privateBucket = privateBucket || bucket;
  }

  async save({
    buffer,
    filename,
    contentType,
  }: SaveFileInput): Promise<SaveFileResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
        // Filenames are random UUIDs, never reused for different content —
        // safe to cache aggressively and forever.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { url: `${this.publicUrlBase}/${filename}` };
  }

  // A distinct bucket from the one save() writes to — the object is never
  // given a publicUrlBase URL and (given S3_PRIVATE_BUCKET is actually
  // configured, see the constructor's warning above) that bucket carries
  // no public-read policy either, so the only way back to its bytes is
  // readPrivate() below, which every caller reaches through an
  // application-level authorization check first.
  async savePrivate({
    buffer,
    filename,
    contentType,
  }: SaveFileInput): Promise<SavePrivateFileResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.privateBucket,
        Key: filename,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return { key: filename };
  }

  async readPrivate(key: string): Promise<ReadPrivateFileResult> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.privateBucket, Key: key }),
    );
    const bytes = await result.Body!.transformToByteArray();
    return { buffer: Buffer.from(bytes) };
  }
}
