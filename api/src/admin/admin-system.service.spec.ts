import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AdminSystemService } from "./admin-system.service";
import { MailService } from "../mail/mail.service";

describe("AdminSystemService", () => {
  let service: AdminSystemService;
  let configService: { get: jest.Mock };
  let mailService: { getDiagnostics: jest.Mock; sendTest: jest.Mock };

  function configure(values: Record<string, unknown>) {
    configService.get.mockImplementation((key: string) => values[key]);
  }

  beforeEach(async () => {
    configService = { get: jest.fn() };
    mailService = {
      getDiagnostics: jest
        .fn()
        .mockReturnValue({ configured: false, lastAttempt: null }),
      sendTest: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSystemService,
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();
    service = module.get(AdminSystemService);
  });

  it("reports each optional integration as unconfigured when its env vars are unset", () => {
    configure({
      storage: { driver: "local" },
      database: { ssl: false },
      mail: { smtpHost: "" },
      webPush: { publicKey: "", privateKey: "" },
      errorTracking: { dsn: "" },
      nodeEnv: "development",
    });

    const status = service.getStatus();

    expect(status.storageDriver).toBe("local");
    expect(status.databaseSslEnabled).toBe(false);
    expect(status.integrations).toEqual({
      email: false,
      pushNotifications: false,
      crashReporting: false,
    });
  });

  it("reports each integration as configured once its credentials are set", () => {
    configure({
      storage: { driver: "s3" },
      database: { ssl: true },
      mail: { smtpHost: "smtp.example.com" },
      webPush: { publicKey: "pub", privateKey: "priv" },
      errorTracking: { dsn: "https://sentry.example/1" },
      nodeEnv: "production",
    });

    const status = service.getStatus();

    expect(status.storageDriver).toBe("s3");
    expect(status.databaseSslEnabled).toBe(true);
    expect(status.environment).toBe("production");
    expect(status.integrations).toEqual({
      email: true,
      pushNotifications: true,
      crashReporting: true,
    });
  });

  it("only treats push as configured when both keys are present", () => {
    configure({
      storage: { driver: "local" },
      database: { ssl: false },
      mail: { smtpHost: "" },
      webPush: { publicKey: "pub", privateKey: "" },
      errorTracking: { dsn: "" },
      nodeEnv: "development",
    });

    expect(service.getStatus().integrations.pushNotifications).toBe(false);
  });

  it("surfaces MailService's diagnostics as the status's mail field", () => {
    configure({
      storage: { driver: "local" },
      database: { ssl: false },
      mail: { smtpHost: "smtp.example.com" },
      webPush: { publicKey: "", privateKey: "" },
      errorTracking: { dsn: "" },
      nodeEnv: "development",
    });
    mailService.getDiagnostics.mockReturnValue({
      configured: true,
      lastAttempt: {
        at: "2026-01-01T00:00:00.000Z",
        to: "someone@example.com",
        subject: "Verify your LIBERIA360 email",
        success: false,
        error: "Invalid login: 535 authentication failed",
      },
    });

    expect(service.getStatus().mail).toEqual({
      configured: true,
      lastAttempt: {
        at: "2026-01-01T00:00:00.000Z",
        to: "someone@example.com",
        subject: "Verify your LIBERIA360 email",
        success: false,
        error: "Invalid login: 535 authentication failed",
      },
    });
  });

  describe("sendTestEmail", () => {
    it("delegates to MailService.sendTest with the given address", async () => {
      mailService.sendTest.mockResolvedValue({ success: true, error: null });
      const result = await service.sendTestEmail("admin@example.com");
      expect(mailService.sendTest).toHaveBeenCalledWith("admin@example.com");
      expect(result).toEqual({ success: true, error: null });
    });

    it("passes through a failure without throwing", async () => {
      mailService.sendTest.mockResolvedValue({
        success: false,
        error: "SMTP is not configured",
      });
      const result = await service.sendTestEmail("admin@example.com");
      expect(result).toEqual({
        success: false,
        error: "SMTP is not configured",
      });
    });
  });
});
