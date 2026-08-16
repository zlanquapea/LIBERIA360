import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validateProductionConfig } from "./validate-production-config";
import { AppConfig } from "./configuration";

const SECURE_CONFIG: Pick<
  AppConfig,
  | "nodeEnv"
  | "jwt"
  | "twoFactor"
  | "storage"
  | "mail"
  | "webPush"
  | "errorTracking"
> = {
  nodeEnv: "production",
  jwt: { secret: "a-real-random-secret", expiresIn: "7d" },
  twoFactor: { encryptionKey: "a-real-random-hex-key" },
  storage: {
    driver: "s3",
    s3: {
      bucket: "b",
      region: "auto",
      accessKeyId: "k",
      secretAccessKey: "s",
      endpoint: "",
      publicUrlBase: "https://cdn.example.com",
    },
  },
  mail: {
    smtpHost: "smtp.example.com",
    smtpPort: 587,
    smtpUser: "u",
    smtpPassword: "p",
    smtpSecure: false,
    from: "LIBERIA360 <no-reply@example.com>",
  },
  webPush: {
    publicKey: "a-real-vapid-key",
    privateKey: "a-real-vapid-private-key",
    contactEmail: "mailto:a@example.com",
  },
  errorTracking: { dsn: "https://key@sentry.example.com/1" },
};

function buildConfigService(overrides: Partial<typeof SECURE_CONFIG> = {}) {
  const config: Record<string, unknown> = { ...SECURE_CONFIG, ...overrides };
  return {
    get: jest.fn((key: string) => config[key]),
  } as unknown as ConfigService<AppConfig, true>;
}

describe("validateProductionConfig", () => {
  let exitSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    // Suppress Nest Logger output in test runs and let us assert on it.
    errorSpy = jest.spyOn(Logger.prototype, "error").mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does nothing at all outside production", () => {
    const configService = buildConfigService({ nodeEnv: "development" });
    validateProductionConfig(configService);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    // Only nodeEnv should have been read before the early return.
    expect(configService.get).toHaveBeenCalledTimes(1);
  });

  it("refuses to boot in production with the dev-placeholder JWT secret", () => {
    const configService = buildConfigService({
      jwt: { secret: "dev-only-insecure-secret-change-me", expiresIn: "7d" },
    });
    validateProductionConfig(configService);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("JWT_SECRET"),
    );
  });

  it("refuses to boot in production with the dev-placeholder 2FA key", () => {
    const configService = buildConfigService({
      twoFactor: { encryptionKey: "dead".repeat(16) },
    });
    validateProductionConfig(configService);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("TWO_FACTOR_ENCRYPTION_KEY"),
    );
  });

  it("boots cleanly (no exit, no warnings) when everything is configured", () => {
    const configService = buildConfigService();
    validateProductionConfig(configService);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns but does not exit when storage is still local", () => {
    const configService = buildConfigService({
      storage: {
        driver: "local",
        s3: {
          bucket: "",
          region: "auto",
          accessKeyId: "",
          secretAccessKey: "",
          endpoint: "",
          publicUrlBase: "",
        },
      },
    });
    validateProductionConfig(configService);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("STORAGE_DRIVER"),
    );
  });

  it("warns but does not exit when SMTP is unset", () => {
    const configService = buildConfigService({
      mail: {
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPassword: "",
        smtpSecure: false,
        from: "LIBERIA360 <no-reply@example.com>",
      },
    });
    validateProductionConfig(configService);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("SMTP_HOST"));
  });

  it("warns but does not exit when VAPID keys are unset", () => {
    const configService = buildConfigService({
      webPush: {
        publicKey: "",
        privateKey: "",
        contactEmail: "mailto:a@example.com",
      },
    });
    validateProductionConfig(configService);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("VAPID"));
  });

  it("warns but does not exit when SENTRY_DSN is unset", () => {
    const configService = buildConfigService({ errorTracking: { dsn: "" } });
    validateProductionConfig(configService);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("SENTRY_DSN"));
  });
});
