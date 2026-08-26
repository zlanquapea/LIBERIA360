import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { LoginActivityService } from "./login-activity.service";
import { LoginActivity } from "./entities/login-activity.entity";
import { User } from "../users/entities/user.entity";
import { MailService } from "../mail/mail.service";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";

describe("LoginActivityService", () => {
  let service: LoginActivityService;
  let activityRepo: {
    save: jest.Mock;
    create: jest.Mock;
    findAndCount: jest.Mock;
    count: jest.Mock;
    find: jest.Mock;
  };
  let userRepo: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
  };
  let qb: {
    select: jest.Mock;
    where: jest.Mock;
    getRawMany: jest.Mock;
  };
  let mailService: { sendFailedLoginAlert: jest.Mock };
  let settingsService: { getApplicationSettings: jest.Mock };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };

  beforeEach(async () => {
    activityRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((data) => data),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };
    qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn().mockResolvedValue([]),
    };
    mailService = {
      sendFailedLoginAlert: jest.fn().mockResolvedValue(undefined),
    };
    settingsService = {
      getApplicationSettings: jest.fn().mockResolvedValue({
        failedLoginAlertThreshold1h: 5,
        failedLoginAlertThreshold24h: 20,
      }),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginActivityService,
        { provide: getRepositoryToken(LoginActivity), useValue: activityRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => "https://liberia360.example") },
        },
        { provide: SettingsService, useValue: settingsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(LoginActivityService);
  });

  describe("record", () => {
    it("saves a lowercased email and the given fields", async () => {
      await service.record({
        userId: "u1",
        emailAttempted: "Someone@Example.com",
        success: false,
        reason: "invalid_credentials",
        requestInfo: { ipAddress: "203.0.113.5", userAgent: "curl/8.0" },
      });
      expect(activityRepo.save).toHaveBeenCalledWith({
        userId: "u1",
        emailAttempted: "someone@example.com",
        success: false,
        reason: "invalid_credentials",
        ipAddress: "203.0.113.5",
        userAgent: "curl/8.0",
      });
    });

    it("defaults ip/user-agent to null when no request info is given", async () => {
      await service.record({
        userId: null,
        emailAttempted: "x@example.com",
        success: true,
        reason: "success",
      });
      expect(activityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: null, userAgent: null }),
      );
    });

    it("swallows a save failure instead of throwing — a logging hiccup should never fail a real login", async () => {
      activityRepo.save.mockRejectedValue(new Error("connection reset"));
      await expect(
        service.record({
          userId: null,
          emailAttempted: "x@example.com",
          success: true,
          reason: "success",
        }),
      ).resolves.toBeUndefined();
    });

    it("never checks thresholds for a successful login", async () => {
      await service.record({
        userId: "u1",
        emailAttempted: "x@example.com",
        success: true,
        reason: "success",
      });
      expect(activityRepo.count).not.toHaveBeenCalled();
    });

    it("stays quiet under the 1h threshold", async () => {
      activityRepo.count.mockResolvedValue(3);
      userRepo.find.mockResolvedValue([
        { email: "super@example.com", name: "Ada" },
      ]);
      await service.record({
        userId: null,
        emailAttempted: "x@example.com",
        success: false,
        reason: "invalid_credentials",
      });
      expect(mailService.sendFailedLoginAlert).not.toHaveBeenCalled();
    });

    it("emails every super admin the instant the 1h count first exceeds the threshold", async () => {
      activityRepo.count.mockResolvedValue(6); // FAILED_LOGIN_ALERT_THRESHOLD_1H + 1
      userRepo.find.mockResolvedValue([
        { email: "super1@example.com", name: "Ada" },
        { email: "super2@example.com", name: "Nyema" },
      ]);
      await service.record({
        userId: null,
        emailAttempted: "x@example.com",
        success: false,
        reason: "invalid_credentials",
      });
      expect(userRepo.find).toHaveBeenCalledWith({
        where: { isSuperAdmin: true },
      });
      expect(mailService.sendFailedLoginAlert).toHaveBeenCalledTimes(2);
      expect(mailService.sendFailedLoginAlert).toHaveBeenCalledWith(
        "super1@example.com",
        "Ada",
        6,
        "hour",
        "https://liberia360.example/admin/security/alerts",
      );
    });

    it("does not re-alert on every attempt after the threshold has already been crossed", async () => {
      activityRepo.count.mockResolvedValue(9); // already well past the +1 crossing point
      userRepo.find.mockResolvedValue([
        { email: "super@example.com", name: "Ada" },
      ]);
      await service.record({
        userId: null,
        emailAttempted: "x@example.com",
        success: false,
        reason: "invalid_credentials",
      });
      expect(mailService.sendFailedLoginAlert).not.toHaveBeenCalled();
    });

    it("uses Settings > Application's threshold, not a hardcoded default, once a super admin changes it", async () => {
      settingsService.getApplicationSettings.mockResolvedValue({
        failedLoginAlertThreshold1h: 10,
        failedLoginAlertThreshold24h: 20,
      });
      activityRepo.count.mockResolvedValue(11); // configured threshold + 1
      userRepo.find.mockResolvedValue([
        { email: "super@example.com", name: "Ada" },
      ]);
      await service.record({
        userId: null,
        emailAttempted: "x@example.com",
        success: false,
        reason: "invalid_credentials",
      });
      expect(mailService.sendFailedLoginAlert).toHaveBeenCalledWith(
        "super@example.com",
        "Ada",
        11,
        "hour",
        "https://liberia360.example/admin/security/alerts",
      );
    });

    it("also notifies every super admin in-app alongside the email", async () => {
      activityRepo.count.mockResolvedValue(6);
      userRepo.find.mockResolvedValue([
        { id: "super-1", email: "super1@example.com", name: "Ada" },
        { id: "super-2", email: "super2@example.com", name: "Nyema" },
      ]);
      await service.record({
        userId: null,
        emailAttempted: "x@example.com",
        success: false,
        reason: "invalid_credentials",
      });
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        ["super-1", "super-2"],
        expect.objectContaining({
          type: "admin.failed_login_alert",
          body: expect.stringContaining("hour"),
        }),
      );
    });

    it("a failed email send for one super admin doesn't stop the others from being alerted", async () => {
      activityRepo.count.mockResolvedValue(6);
      userRepo.find.mockResolvedValue([
        { email: "super1@example.com", name: "Ada" },
        { email: "super2@example.com", name: "Nyema" },
      ]);
      mailService.sendFailedLoginAlert.mockRejectedValueOnce(
        new Error("smtp down"),
      );
      await expect(
        service.record({
          userId: null,
          emailAttempted: "x@example.com",
          success: false,
          reason: "invalid_credentials",
        }),
      ).resolves.toBeUndefined();
      expect(mailService.sendFailedLoginAlert).toHaveBeenCalledTimes(2);
    });
  });

  describe("findAll", () => {
    it("paginates using the given page/limit, ordered by createdAt DESC", async () => {
      activityRepo.findAndCount.mockResolvedValue([[{ id: "a1" }], 45]);
      const result = await service.findAll(2, 20);
      expect(activityRepo.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: "DESC" },
        skip: 20,
        take: 20,
      });
      expect(result.meta).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
    });

    it("filters to failed attempts only when onlyFailed is true", async () => {
      await service.findAll(1, 20, true);
      expect(activityRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { success: false } }),
      );
    });
  });

  describe("getOverview", () => {
    it("counts distinct failing IPs, not raw failure rows", async () => {
      activityRepo.find.mockResolvedValue([
        { ipAddress: "1.1.1.1" },
        { ipAddress: "1.1.1.1" },
        { ipAddress: "2.2.2.2" },
        { ipAddress: null },
      ]);
      const overview = await service.getOverview();
      expect(overview.distinctFailingIpsLast24h).toBe(2);
    });

    it("computes admin 2FA adoption from admin/super-admin accounts only", async () => {
      qb.getRawMany.mockResolvedValue([
        { twoFactorEnabled: true },
        { twoFactorEnabled: false },
        { twoFactorEnabled: true },
      ]);
      const overview = await service.getOverview();
      expect(overview.adminTwoFactorAdoption).toEqual({ total: 3, enabled: 2 });
    });
  });
});
