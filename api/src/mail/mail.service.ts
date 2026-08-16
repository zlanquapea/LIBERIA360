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

/**
 * Transactional email (password reset, email verification). Same
 * progressive-enhancement shape as PushService: an unconfigured SMTP host
 * doesn't stop the app from booting or the calling flow (register,
 * forgot-password) from succeeding — sending just logs the message body
 * instead of delivering it, which doubles as a genuinely useful local-dev
 * experience (the reset/verify link is right there in the server log,
 * no real inbox needed to test the flow end to end).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly configured: boolean;
  private readonly from: string;
  private transporter: nodemailer.Transporter | null = null;

  constructor(configService: ConfigService<AppConfig, true>) {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure, from } =
      configService.get("mail", { infer: true });
    this.from = from;
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
      html: this.wrap(
        `<p>Welcome to LIBERIA360! Verify your email address to finish setting up your account.</p>` +
          this.button("Verify email", verifyUrl) +
          `<p style="color:#666;font-size:13px">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
      ),
    });
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.send({
      to,
      subject: "Reset your LIBERIA360 password",
      text: `We received a request to reset your LIBERIA360 password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.`,
      html: this.wrap(
        `<p>We received a request to reset your LIBERIA360 password.</p>` +
          this.button("Reset password", resetUrl) +
          `<p style="color:#666;font-size:13px">This link expires in 1 hour. If you didn't request this, you can ignore this email — your password won't change.</p>`,
      ),
    });
  }

  private async send(message: MailMessage): Promise<void> {
    if (!this.configured || !this.transporter) {
      // Fire-and-forget by design (see class doc) — never throw out of
      // here and never block whatever flow triggered the email.
      this.logger.log(
        `[DEV] Email to ${message.to} — ${message.subject}\n${message.text}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      // A broken mail provider shouldn't fail registration or a password
      // reset request — the flow degrades to "the link doesn't arrive,"
      // not "the request 500s."
      this.logger.error(
        `Failed to send email to ${message.to}: ${(error as Error).message}`,
      );
    }
  }

  private button(label: string, url: string): string {
    return `<p><a href="${url}" style="display:inline-block;background:#16307a;color:#fff;padding:10px 20px;border-radius:999px;text-decoration:none;font-weight:600">${label}</a></p><p style="color:#666;font-size:13px">Or paste this link into your browser: ${url}</p>`;
  }

  private wrap(bodyHtml: string): string {
    return `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px"><h2 style="color:#16307a">LIBERIA360</h2>${bodyHtml}</div>`;
  }
}
