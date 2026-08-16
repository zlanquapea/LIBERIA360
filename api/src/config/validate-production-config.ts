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
}
