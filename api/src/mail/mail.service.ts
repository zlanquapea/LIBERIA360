import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { AppConfig } from "../config/configuration";

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailAttempt {
  at: string; // ISO timestamp
  to: string;
  subject: string;
  success: boolean;
  error: string | null;
}

export interface MailDiagnostics {
  configured: boolean;
  lastAttempt: MailAttempt | null;
}

/**
 * Transactional email (password reset, email verification). Same
 * progressive-enhancement shape as PushService: an unconfigured SMTP host
 * doesn't stop the app from booting or the calling flow (register,
 * forgot-password) from succeeding — sending just logs the message body
 * instead of delivering it, which doubles as a genuinely useful local-dev
 * experience (the reset/verify link is right there in the server log,
 * no real inbox needed to test the flow end to end).
 *
 * Every non-diagnostic send() call below swallows delivery errors on
 * purpose — a broken mail provider must never fail registration or a
 * password-reset request. That's the right behavior for those flows, but
 * it also means "the button said Sent but nothing arrived" was previously
 * only debuggable by reading raw server logs. `lastAttempt` (surfaced via
 * GET /admin/system/status) and `sendTest()` (POST /admin/system/test-email)
 * exist specifically to close that gap for a super admin, without changing
 * the fire-and-forget contract everything else relies on.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly configured: boolean;
  private readonly from: string;
  // Logo is referenced by URL, not inlined as base64 — the source PNG
  // (web/public/logo.png) is ~900KB, well past the point where Gmail
  // clips a message and other clients balk at the payload. The 192px PWA
  // icon (web/public/icons/icon-192.png) is the same mark at ~32KB,
  // already served publicly by the web app, and exactly the size an email
  // header needs — see web/README.md's note on why logo.png itself reads
  // busy at small sizes (this is a different, purpose-built asset).
  private readonly logoUrl: string;
  private transporter: nodemailer.Transporter | null = null;
  // Process-lifetime only (not persisted) — same reasoning as
  // AdminSystemService's uptime counter. Good enough for "is this still
  // broken right now," which is what the admin panel actually needs.
  private lastAttempt: MailAttempt | null = null;

  constructor(configService: ConfigService<AppConfig, true>) {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, from } =
      configService.get("mail", { infer: true });
    this.from = from;
    const webAppUrl = configService.get("webAppUrl", { infer: true });
    this.logoUrl = `${webAppUrl}/icons/icon-192.png`;
    this.configured = Boolean(smtpHost && smtpUser && smtpPassword);

    if (this.configured) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPassword },
      });
    } else {
      this.logger.warn(
        "SMTP not configured — emails will be logged, not sent. See api/README.md.",
      );
    }
  }

  async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
    await this.send({
      to,
      subject: "Verify your LIBERIA360 email",
      text: `Welcome to LIBERIA360! Verify your email address:\n\n${verifyUrl}\n\nThis link expires in 24 hours. If you didn't create this account, you can ignore this email.`,
      html: this.render({
        heading: "Confirm your email address",
        intro:
          "Welcome to LIBERIA360 — your guide to destinations, stays, and local experiences across Liberia. One quick step before you start exploring: confirm this is really your email address.",
        ctaLabel: "Verify email address",
        ctaUrl: verifyUrl,
        note: "This link expires in 24 hours. If you didn't create a LIBERIA360 account, you can safely ignore this email — no account will be created without verification.",
      }),
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: "Reset your LIBERIA360 password",
      text: `We received a request to reset your LIBERIA360 password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.`,
      html: this.render({
        heading: "Reset your password",
        intro:
          "We received a request to reset the password on your LIBERIA360 account. Click below to choose a new one.",
        ctaLabel: "Reset password",
        ctaUrl: resetUrl,
        note: "This link expires in 1 hour. If you didn't request this, you can safely ignore this email — your password won't change.",
      }),
    });
  }

  /** POST /admin/system/test-email — deliberately does NOT swallow the
   * error, unlike every send above: the whole point is letting a super
   * admin tell "SMTP isn't configured" apart from "SMTP is configured but
   * the credentials/port/host are wrong" without needing server log
   * access, which is exactly the visibility gap behind "it says Sent but
   * nothing arrives." */
  async sendTest(
    to: string,
  ): Promise<{ success: boolean; error: string | null }> {
    if (!this.configured || !this.transporter) {
      return {
        success: false,
        error:
          "SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — see api/README.md's Email section.",
      };
    }

    const message: MailMessage = {
      to,
      subject: "LIBERIA360 test email",
      text: `This is a test email from LIBERIA360's System & Operations panel, confirming outgoing email is configured correctly.\n\nSent ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.`,
      html: this.render({
        heading: "Outgoing email is working",
        intro:
          "This is a test message sent from LIBERIA360's System &amp; Operations panel. If it reached your inbox, SMTP is configured correctly and verification/password-reset emails should be delivering normally too.",
        note: `Sent ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.`,
      }),
    };

    try {
      await this.deliver(message);
      this.recordAttempt(message, true, null);
      return { success: true, error: null };
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Test email to ${to} failed: ${errorMessage}`);
      this.recordAttempt(message, false, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /** GET /admin/system/status's mail section — see the class doc for why
   * this exists. */
  getDiagnostics(): MailDiagnostics {
    return { configured: this.configured, lastAttempt: this.lastAttempt };
  }

  private async send(message: MailMessage): Promise<void> {
    if (!this.configured || !this.transporter) {
      // Fire-and-forget by design (see class doc) — never throw out of
      // here and never block whatever flow triggered the email. Not
      // recorded as a `lastAttempt`: unconfigured means nothing was ever
      // really attempted, and `configured: false` alone already tells the
      // System & Operations panel everything it needs to.
      this.logger.log(
        `[DEV] Email to ${message.to} — ${message.subject}\n${message.text}`,
      );
      return;
    }

    try {
      await this.deliver(message);
      this.recordAttempt(message, true, null);
    } catch (error) {
      // A broken mail provider shouldn't fail registration or a password
      // reset request — the flow degrades to "the link doesn't arrive,"
      // not "the request 500s."
      const errorMessage = (error as Error).message;
      this.logger.error(
        `Failed to send email to ${message.to}: ${errorMessage}`,
      );
      this.recordAttempt(message, false, errorMessage);
    }
  }

  private async deliver(message: MailMessage): Promise<void> {
    if (!this.transporter) {
      throw new Error("SMTP is not configured");
    }
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private recordAttempt(
    message: MailMessage,
    success: boolean,
    error: string | null,
  ): void {
    this.lastAttempt = {
      at: new Date().toISOString(),
      to: message.to,
      subject: message.subject,
      success,
      error,
    };
  }

  // Table-based layout + every style inlined, no <style> block or
  // flexbox/grid — the baseline that actually renders consistently across
  // Outlook/Gmail/Apple Mail's wildly inconsistent CSS support. The hidden
  // preheader span is what shows as the message preview text in an inbox
  // list (Gmail/Apple Mail read it even though it's invisible in the
  // opened email) instead of falling back to visible boilerplate.
  private render(opts: {
    heading: string;
    intro: string;
    ctaLabel?: string;
    ctaUrl?: string;
    note?: string;
  }): string {
    const preheader =
      opts.intro.length > 140 ? `${opts.intro.slice(0, 137)}…` : opts.intro;

    const cta = opts.ctaUrl
      ? `<tr>
          <td align="center" style="padding:4px 40px 4px;">
            <a href="${opts.ctaUrl}" style="display:inline-block;background:#16307a;color:#ffffff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:600;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${opts.ctaLabel}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 0;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Or paste this link into your browser:<br /><a href="${opts.ctaUrl}" style="color:#3355ad;">${opts.ctaUrl}</a></p>
          </td>
        </tr>`
      : "";

    const note = opts.note
      ? `<tr>
          <td style="padding:20px 40px 0;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${opts.note}</p>
          </td>
        </tr>`
      : "";

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LIBERIA360</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f3fa;">
    <span style="display:none;font-size:1px;color:#f1f3fa;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f3fa;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #e2e6f2;">
            <tr>
              <td align="center" style="padding:32px 32px 16px;">
                <img src="${this.logoUrl}" width="64" height="64" alt="LIBERIA360" style="display:block;border-radius:16px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0e2361;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${opts.heading}</h1>
                <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#374151;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${opts.intro}</p>
              </td>
            </tr>
            ${cta}
            ${note}
            <tr>
              <td style="padding:28px 40px 32px;">
                <hr style="border:none;border-top:1px solid #eef0f7;margin:0 0 20px;" />
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">LIBERIA360 — Discover. Experience. Share.<br />Liberia's guide to destinations, stays, and local experiences.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }
}
