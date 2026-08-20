import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AdminSystemService } from "./admin-system.service";

describe("AdminSystemService", () => {
  let service: AdminSystemService;
  let configService: { get: jest.Mock };

  function configure(values: Record<string, unknown>) {
    configService.get.mockImplementation((key: string) => values[key]);
  }

  beforeEach(async () => {
    configService = { get: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSystemService,
        { provide: ConfigService, useValue: configService },
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
});
