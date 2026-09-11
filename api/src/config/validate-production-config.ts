import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "./configuration";

const logger = new Logger("ConfigValidation");

// The exact dev-only fallback values from configuration.ts — checked
// against verbatim so a genuinely-random secret that happens to also be
// insecure (too short, say) doesn't false-positive here. This only catches
// "the .env.example placeholder made it into production unchanged," which
// is the specific, common failure mode worth refusing to boot over.
const INSECURE_JWT_SECRET = "dev-only-insecure-secret-change-me";
const INSECURE_TWO_FACTOR_KEY = "dead".repeat(16);

/**
 * Fails fast on the two config mistakes that are actively dangerous rather
 * than just incomplete: booting in production with the committed dev
 * fallback for JWT_SECRET (anyone can forge a valid login token) or
 * TWO_FACTOR_ENCRYPTION_KEY (anyone can decrypt every account's TOTP
 * secret straight out of a DB dump). Everything else that's merely
 * *unconfigured* (mail, S3, VAPID) degrades gracefully by design — see
 * PushService — and only gets a loud warning here, not a boot refusal,
 * since the app is still safe to run without them, just missing features.
 */
export function validateProductionConfig(
  configService: ConfigService<AppConfig, true>,
): void {
  const nodeEnv = configService.get("nodeEnv", { infer: true });
  if (nodeEnv !== "production") {
    return;
  }

  const jwt = configService.get("jwt", { infer: true });
  const twoFactor = configService.get("twoFactor", { infer: true });
  const storage = configService.get("storage", { infer: true });
  const mail = configService.get("mail", { infer: true });
  const webPush = configService.get("webPush", { infer: true });
  const errorTracking = configService.get("errorTracking", { infer: true });

  const fatal: string[] = [];
  if (jwt.secret === INSECURE_JWT_SECRET) {
    fatal.push(
      "JWT_SECRET is still the insecure dev default. Generate a real one:\n" +
        "    node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }
  if (twoFactor.encryptionKey === INSECURE_TWO_FACTOR_KEY) {
    fatal.push(
      "TWO_FACTOR_ENCRYPTION_KEY is still the insecure dev default. Generate a real one:\n" +
        "    node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  // Unlike the other storage/mail/push checks below, this one is fatal: the
  // S3StorageProvider fallback silently writes prescriptions and other
  // private uploads into the *public* bucket when S3_PRIVATE_BUCKET is
  // unset, which is a live privacy exposure the moment a real prescription
  // is uploaded — not a merely-missing feature like SMTP or VAPID keys.
  if (storage.driver === "s3" && !storage.s3.privateBucket) {
    fatal.push(
      "S3_PRIVATE_BUCKET is not set with STORAGE_DRIVER=s3. Private uploads (e.g. pharmacy prescriptions) would " +
        "silently fall back to S3_BUCKET, the same bucket public uploads use — anyone who discovers or leaks an " +
        "object key bypasses every access check. Set S3_PRIVATE_BUCKET to a distinct bucket with no public-read " +
        "policy before starting in production.",
    );
  }
  // Setting S3_PRIVATE_BUCKET is not by itself enough — pointing it at the
  // same bucket S3_BUCKET already uses (public-read) recreates exactly the
  // exposure the check above exists to prevent, just without tripping the
  // "unset" condition.
  if (
    storage.driver === "s3" &&
    storage.s3.privateBucket &&
    storage.s3.privateBucket === storage.s3.bucket
  ) {
    fatal.push(
      "S3_PRIVATE_BUCKET is set to the same bucket as S3_BUCKET. That bucket is expected to have a public-read " +
        "policy for normal uploads, so private uploads (e.g. pharmacy prescriptions) written there are exactly as " +
        "exposed as if S3_PRIVATE_BUCKET were unset. Set S3_PRIVATE_BUCKET to a genuinely distinct bucket with no " +
        "public-read policy before starting in production.",
    );
  }

  if (fatal.length > 0) {
    logger.error(
      "Refusing to start with NODE_ENV=production and insecure secrets:\n\n" +
        fatal.map((m) => `  - ${m}`).join("\n\n") +
        "\n",
    );
    process.exit(1);
  }

  if (storage.driver === "local") {
    logger.warn(
      "STORAGE_DRIVER is 'local' in production — uploaded photos are written to local disk on this instance. " +
        "They will not survive a redeploy and will not be visible from any other instance behind a load balancer. " +
        "Set STORAGE_DRIVER=s3 (see api/README.md) before real users start uploading photos.",
    );
  }
  if (!mail.smtpHost) {
    logger.warn(
      "SMTP_HOST is not set in production — password reset and email verification messages will be logged, not delivered. " +
        "Set SMTP_HOST/SMTP_USER/SMTP_PASSWORD (see api/README.md) before launch.",
    );
  }
  if (!webPush.publicKey) {
    logger.warn(
      "VAPID keys are not set in production — push notifications are disabled (this is safe, just a missing feature).",
    );
  }
  if (!errorTracking.dsn) {
    logger.warn(
      "SENTRY_DSN is not set in production — crashes are only logged locally, not reported anywhere. Safe to run without it, just less visibility.",
    );
  }
  // EventTicketsService.getQrKey() falls back to JWT_SECRET when this is
  // unset, deriving the AES key that encrypts every issued ticket's QR
  // token from it. JWT_SECRET is meant to be rotatable (that's exactly
  // what makes it a good session secret); rotating it here silently
  // changes this derived key too, and every ticket QR encrypted under the
  // old one becomes permanently undecryptable (the ticket itself stays
  // valid and scannable — only redisplaying its QR breaks). Not fatal:
  // buildTicketQr degrades a broken ticket gracefully rather than crashing.
  if (!process.env.TICKET_QR_SECRET) {
    logger.warn(
      "TICKET_QR_SECRET is not set in production — event ticket QR codes are being encrypted with JWT_SECRET " +
        "instead. Any future JWT_SECRET rotation will make every previously-issued ticket's QR code permanently " +
        "undecryptable for display (tickets stay valid and scannable at the door either way). Set a dedicated, " +
        "stable TICKET_QR_SECRET before launch to avoid that.",
    );
  }
}
