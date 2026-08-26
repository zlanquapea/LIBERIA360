import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../config/configuration";
import { MailService, MailDiagnostics } from "../mail/mail.service";

export interface SystemStatus {
  environment: string;
  apiUptimeSeconds: number;
  storageDriver: "local" | "s3";
  databaseSslEnabled: boolean;
  integrations: {
    email: boolean;
    pushNotifications: boolean;
    crashReporting: boolean;
    adminLoginIpAllowlist: boolean;
  };
  // Richer than integrations.email above — whether the credentials are
  // present AND, once they are, what actually happened the last time this
  // process tried to send. Exists specifically so "the button said Sent
  // but nothing arrived" (integrations.email: true doesn't rule out wrong
  // credentials/host/port) is diagnosable from this page instead of only
  // from server logs — see MailService's class doc.
  mail: MailDiagnostics;
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
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly mailService: MailService,
  ) {}

  getStatus(): SystemStatus {
    const storage = this.configService.get("storage", { infer: true });
    const database = this.configService.get("database", { infer: true });
    const mail = this.configService.get("mail", { infer: true });
    const webPush = this.configService.get("webPush", { infer: true });
    const errorTracking = this.configService.get("errorTracking", {
      infer: true,
    });
    const adminSecurity = this.configService.get("adminSecurity", {
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
        adminLoginIpAllowlist: adminSecurity.loginIpAllowlist.length > 0,
      },
      mail: this.mailService.getDiagnostics(),
    };
  }

  /** POST /admin/system/test-email — sends to the calling admin's own
   * address only (never an arbitrary target), the same "confirm it works
   * for real, not just that credentials are present" check as clicking
   * "resend verification" yourself, but with the actual success/failure
   * reported back instead of a blind "Sent" message. */
  sendTestEmail(
    to: string,
  ): Promise<{ success: boolean; error: string | null }> {
    return this.mailService.sendTest(to);
  }
}
