import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../config/configuration";

export interface SystemStatus {
  environment: string;
  apiUptimeSeconds: number;
  storageDriver: "local" | "s3";
  databaseSslEnabled: boolean;
  integrations: {
    email: boolean;
    pushNotifications: boolean;
    crashReporting: boolean;
  };
}

const processStartedAt = Date.now();

/** System / Operations — real runtime state, not a mock. Every flag here
 * is already computed in configuration.ts as "does this integration have
 * real credentials, or is it a no-op" (see api/README.md: "Every other
 * integration ... degrades gracefully when unconfigured"); this just
 * surfaces those booleans to a super admin instead of leaving them
 * something only visible by reading environment variables directly.
 * Deliberately returns no secrets, hostnames, or credentials — only
 * whether each one is configured. */
@Injectable()
export class AdminSystemService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  getStatus(): SystemStatus {
    const storage = this.configService.get("storage", { infer: true });
    const database = this.configService.get("database", { infer: true });
    const mail = this.configService.get("mail", { infer: true });
    const webPush = this.configService.get("webPush", { infer: true });
    const errorTracking = this.configService.get("errorTracking", {
      infer: true,
    });

    return {
      environment: this.configService.get("nodeEnv", { infer: true }),
      apiUptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000),
      storageDriver: storage.driver,
      databaseSslEnabled: database.ssl,
      integrations: {
        email: Boolean(mail.smtpHost),
        pushNotifications: Boolean(webPush.publicKey && webPush.privateKey),
        crashReporting: Boolean(errorTracking.dsn),
      },
    };
  }
}
