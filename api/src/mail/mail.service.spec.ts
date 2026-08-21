import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { MailService } from "./mail.service";

jest.mock("nodemailer");

const UNCONFIGURED_MAIL = {
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpSecure: false,
  from: "LIBERIA360 <no-reply@liberia360.example>",
};

const CONFIGURED_MAIL = {
  smtpHost: "smtp.example.com",
  smtpPort: 587,
  smtpUser: "user",
  smtpPassword: "pass",
  smtpSecure: false,
  from: "LIBERIA360 <no-reply@liberia360.example>",
};

async function buildService(
  mailConfig: typeof UNCONFIGURED_MAIL,
  sendMail: jest.Mock = jest.fn().mockResolvedValue(undefined),
) {
  (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  const configService = {
    get: jest.fn((key: string) =>
      key === "mail" ? mailConfig : "https://liberia360.example",
    ),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MailService,
      { provide: ConfigService, useValue: configService },
    ],
  }).compile();
  return { service: module.get(MailService), sendMail };
}

describe("MailService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("unconfigured (no SMTP credentials)", () => {
    it("logs instead of sending, and never touches the transporter", async () => {
      const { service, sendMail } = await buildService(UNCONFIGURED_MAIL);
      await service.sendEmailVerification(
        "user@example.com",
        "https://liberia360.example/verify-email?token=abc",
      );
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("reports configured: false and no lastAttempt in diagnostics", async () => {
      const { service } = await buildService(UNCONFIGURED_MAIL);
      await service.sendEmailVerification("user@example.com", "https://x/y");
      expect(service.getDiagnostics()).toEqual({
        configured: false,
        lastAttempt: null,
      });
    });

    it("sendTest reports failure immediately without attempting delivery", async () => {
      const { service, sendMail } = await buildService(UNCONFIGURED_MAIL);
      const result = await service.sendTest("admin@example.com");
      expect(sendMail).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not configured/i);
    });

    it("sendTripInvitation returns false (logged, not delivered)", async () => {
      const { service, sendMail } = await buildService(UNCONFIGURED_MAIL);
      const delivered = await service.sendTripInvitation({
        to: "friend@example.com",
        inviterName: "Ada",
        tripTitle: "Sapo Forest Trek",
        durationDays: 3,
        destinationSummary: "Sinoe County",
        inviteUrl: "https://liberia360.example/invite/abc",
        hasAccount: false,
      });
      expect(sendMail).not.toHaveBeenCalled();
      expect(delivered).toBe(false);
    });
  });

  describe("configured — successful delivery", () => {
    it("sends the email verification message with the token URL in both text and html", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      const verifyUrl = "https://liberia360.example/verify-email?token=abc123";
      await service.sendEmailVerification("user@example.com", verifyUrl);

      expect(sendMail).toHaveBeenCalledTimes(1);
      const call = sendMail.mock.calls[0][0];
      expect(call.to).toBe("user@example.com");
      expect(call.from).toBe(CONFIGURED_MAIL.from);
      expect(call.subject).toContain("Verify your LIBERIA360 email");
      expect(call.text).toContain(verifyUrl);
      expect(call.html).toContain(verifyUrl);
    });

    it("branded HTML includes the LIBERIA360 logo and brand color", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      await service.sendEmailVerification("user@example.com", "https://x/y");
      const html = sendMail.mock.calls[0][0].html;
      expect(html).toContain("https://liberia360.example/icons/icon-192.png");
      expect(html).toContain("#16307a"); // brand-700 — the CTA button color
      expect(html).toContain("LIBERIA360");
    });

    it("sends the password reset message with the token URL", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      const resetUrl = "https://liberia360.example/reset-password?token=xyz";
      await service.sendPasswordReset("user@example.com", resetUrl);

      const call = sendMail.mock.calls[0][0];
      expect(call.subject).toContain("Reset your LIBERIA360 password");
      expect(call.text).toContain(resetUrl);
      expect(call.html).toContain(resetUrl);
    });

    it("records a successful lastAttempt in diagnostics", async () => {
      const { service } = await buildService(CONFIGURED_MAIL);
      await service.sendEmailVerification("user@example.com", "https://x/y");
      const diagnostics = service.getDiagnostics();
      expect(diagnostics.configured).toBe(true);
      expect(diagnostics.lastAttempt).toMatchObject({
        to: "user@example.com",
        success: true,
        error: null,
      });
    });

    it("sendTest delivers to the given address and reports success", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      const result = await service.sendTest("admin@example.com");
      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(sendMail.mock.calls[0][0].to).toBe("admin@example.com");
      expect(result).toEqual({ success: true, error: null });
    });

    it("sendTripInvitation delivers and reports true, with different copy for an account-holder vs not", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      const delivered = await service.sendTripInvitation({
        to: "friend@example.com",
        inviterName: "Ada",
        tripTitle: "Sapo Forest Trek",
        durationDays: 3,
        destinationSummary: "Sinoe County",
        inviteUrl: "https://liberia360.example/invite/abc",
        hasAccount: true,
      });
      expect(delivered).toBe(true);
      const call = sendMail.mock.calls[0][0];
      expect(call.to).toBe("friend@example.com");
      expect(call.subject).toContain("Ada invited you");
      expect(call.html).toContain("https://liberia360.example/invite/abc");
      expect(call.html).toContain("View invitation");
      expect(call.html).not.toContain("Create account");
    });

    it("sendTripInvitation prompts account creation for someone without one", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      await service.sendTripInvitation({
        to: "friend@example.com",
        inviterName: "Ada",
        tripTitle: "Sapo Forest Trek",
        durationDays: 3,
        destinationSummary: "Sinoe County",
        inviteUrl: "https://liberia360.example/invite/abc",
        hasAccount: false,
      });
      expect(sendMail.mock.calls[0][0].html).toContain(
        "Create account & view invitation",
      );
    });

    it("sendTripInvitation escapes HTML in a user-controlled trip title or name", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      await service.sendTripInvitation({
        to: "friend@example.com",
        inviterName: "<script>alert(1)</script>",
        tripTitle: "Trip <b>2</b>",
        durationDays: 1,
        destinationSummary: "Montserrado",
        inviteUrl: "https://liberia360.example/invite/abc",
        hasAccount: true,
      });
      const html = sendMail.mock.calls[0][0].html;
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("sendInvitationAccepted notifies the organizer", async () => {
      const { service, sendMail } = await buildService(CONFIGURED_MAIL);
      await service.sendInvitationAccepted(
        "organizer@example.com",
        "Ada",
        "Sapo Forest Trek",
        "https://liberia360.example/trips/1",
      );
      const call = sendMail.mock.calls[0][0];
      expect(call.to).toBe("organizer@example.com");
      expect(call.subject).toContain("Ada joined your trip");
      expect(call.html).toContain("https://liberia360.example/trips/1");
    });
  });

  describe("configured — delivery fails", () => {
    it("swallows the error out of send() (never throws or rejects the calling flow)", async () => {
      const sendMail = jest
        .fn()
        .mockRejectedValue(
          new Error("Invalid login: 535 authentication failed"),
        );
      const { service } = await buildService(CONFIGURED_MAIL, sendMail);
      await expect(
        service.sendEmailVerification("user@example.com", "https://x/y"),
      ).resolves.toBeUndefined();
    });

    it("records the failure in diagnostics instead of silently disappearing", async () => {
      const sendMail = jest
        .fn()
        .mockRejectedValue(
          new Error("Invalid login: 535 authentication failed"),
        );
      const { service } = await buildService(CONFIGURED_MAIL, sendMail);
      await service.sendEmailVerification("user@example.com", "https://x/y");
      expect(service.getDiagnostics().lastAttempt).toMatchObject({
        success: false,
        error: "Invalid login: 535 authentication failed",
      });
    });

    it("sendTest reports the real failure reason instead of a blind success", async () => {
      const sendMail = jest
        .fn()
        .mockRejectedValue(new Error("Connection timed out"));
      const { service } = await buildService(CONFIGURED_MAIL, sendMail);
      const result = await service.sendTest("admin@example.com");
      expect(result).toEqual({ success: false, error: "Connection timed out" });
    });

    it("sendTripInvitation returns false instead of throwing, so a failed invite email never fails the invite itself", async () => {
      const sendMail = jest.fn().mockRejectedValue(new Error("boom"));
      const { service } = await buildService(CONFIGURED_MAIL, sendMail);
      const delivered = await service.sendTripInvitation({
        to: "friend@example.com",
        inviterName: "Ada",
        tripTitle: "Sapo Forest Trek",
        durationDays: 3,
        destinationSummary: "Sinoe County",
        inviteUrl: "https://liberia360.example/invite/abc",
        hasAccount: true,
      });
      expect(delivered).toBe(false);
    });
  });
});
