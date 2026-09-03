import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReportsService } from "./reports.service";
import { ContentReport } from "./entities/content-report.entity";
import {
  ReportReason,
  ReportTargetType,
} from "./entities/content-report.enums";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { Business } from "../businesses/entities/business.entity";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { PushService } from "../push/push.service";
import { UsersService } from "../users/users.service";
import { ConfigService } from "@nestjs/config";

const DTO = {
  targetType: ReportTargetType.REVIEW,
  targetId: "review-1",
  reason: ReportReason.SPAM,
};

const APPLICATION_SETTINGS = {
  reportFlagThreshold: 3,
  reportWindowDays: 90,
};

const NOTIFICATION_SETTINGS = {
  flaggedContentEmailEnabled: true,
  flaggedContentPushEnabled: false,
  flaggedContentRecipientUserIds: [] as string[],
};

const ADMIN = { id: "admin-1", name: "Admin One", email: "admin1@example.com" };

describe("ReportsService", () => {
  let service: ReportsService;
  let reportRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  let reviewRepo: { exists: jest.Mock; findOne: jest.Mock };
  let eventRepo: { exists: jest.Mock; findOne: jest.Mock };
  let businessRepo: { exists: jest.Mock };
  let settingsService: {
    getApplicationSettings: jest.Mock;
    getAdminNotificationSettings: jest.Mock;
  };
  let notificationsService: { createMany: jest.Mock };
  let mailService: { sendFlaggedContentAlert: jest.Mock };
  let pushService: { sendToUsers: jest.Mock };
  let usersService: { findAdmins: jest.Mock; findByIds: jest.Mock };

  beforeEach(async () => {
    reportRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => ({ id: "report-1", ...data })),
      create: jest.fn((data) => data),
      count: jest.fn().mockResolvedValue(1),
    };
    reviewRepo = {
      exists: jest.fn().mockResolvedValue(true),
      findOne: jest.fn().mockResolvedValue({
        id: "review-1",
        user: { name: "A Traveler" },
      }),
    };
    eventRepo = {
      exists: jest.fn().mockResolvedValue(true),
      findOne: jest.fn().mockResolvedValue({ id: "event-1", name: "Fete" }),
    };
    businessRepo = { exists: jest.fn().mockResolvedValue(true) };
    settingsService = {
      getApplicationSettings: jest.fn().mockResolvedValue(APPLICATION_SETTINGS),
      getAdminNotificationSettings: jest
        .fn()
        .mockResolvedValue(NOTIFICATION_SETTINGS),
    };
    notificationsService = {
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    mailService = {
      sendFlaggedContentAlert: jest.fn().mockResolvedValue(undefined),
    };
    pushService = { sendToUsers: jest.fn().mockResolvedValue(undefined) };
    usersService = {
      findAdmins: jest.fn().mockResolvedValue([ADMIN]),
      findByIds: jest.fn().mockResolvedValue([ADMIN]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(ContentReport), useValue: reportRepo },
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: SettingsService, useValue: settingsService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: MailService, useValue: mailService },
        { provide: PushService, useValue: pushService },
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("https://liberia360.example"),
          },
        },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  it("rejects reporting a review that doesn't exist", async () => {
    reviewRepo.exists.mockResolvedValue(false);
    await expect(service.report("user-1", DTO)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(reportRepo.save).not.toHaveBeenCalled();
  });

  it("rejects reporting an event that doesn't exist", async () => {
    eventRepo.exists.mockResolvedValue(false);
    await expect(
      service.report("user-1", { ...DTO, targetType: ReportTargetType.EVENT }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects reporting a business that doesn't exist", async () => {
    businessRepo.exists.mockResolvedValue(false);
    await expect(
      service.report("user-1", {
        ...DTO,
        targetType: ReportTargetType.BUSINESS,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates a new report", async () => {
    reportRepo.count.mockResolvedValue(1); // below threshold — no notification path
    const result = await service.report("user-1", DTO);
    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reporterUserId: "user-1",
        targetType: ReportTargetType.REVIEW,
        targetId: "review-1",
        reason: ReportReason.SPAM,
        details: null,
      }),
    );
    expect(result.id).toBe("report-1");
  });

  it("upserts — a second report from the same user on the same target replaces the first", async () => {
    reportRepo.findOne.mockResolvedValue({
      id: "existing-report",
      reason: ReportReason.SPAM,
      details: null,
    });
    await service.report("user-1", {
      ...DTO,
      reason: ReportReason.INAPPROPRIATE,
      details: "changed my mind",
    });
    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "existing-report",
        reason: ReportReason.INAPPROPRIATE,
        details: "changed my mind",
      }),
    );
    expect(reportRepo.create).not.toHaveBeenCalled();
    // Editing an existing report doesn't add a new independent reporter,
    // so it must never re-run the flagged-content check.
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it("does not notify while a target is still below the flag threshold", async () => {
    reportRepo.count.mockResolvedValue(2); // threshold is 3
    await service.report("user-1", DTO);
    expect(notificationsService.createMany).not.toHaveBeenCalled();
    expect(mailService.sendFlaggedContentAlert).not.toHaveBeenCalled();
  });

  it("notifies every admin, in-app and by email, the moment a review first crosses the threshold", async () => {
    reportRepo.count.mockResolvedValue(3); // threshold is 3 — first crossing
    await service.report("user-1", DTO);

    expect(notificationsService.createMany).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({
        type: "admin.content_flagged",
        link: "/admin/content/moderation",
      }),
    );
    expect(mailService.sendFlaggedContentAlert).toHaveBeenCalledWith(
      "admin1@example.com",
      "Admin One",
      "A review by A Traveler",
      3,
      expect.stringContaining("/admin/content/moderation"),
    );
    expect(pushService.sendToUsers).not.toHaveBeenCalled();
  });

  it("does not re-notify on a later report past the threshold", async () => {
    reportRepo.count.mockResolvedValue(4); // already past 3
    await service.report("user-1", DTO);
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it("never notifies for a flagged business — businesses don't feed the flagged-content queue", async () => {
    reportRepo.count.mockResolvedValue(3);
    await service.report("user-1", {
      ...DTO,
      targetType: ReportTargetType.BUSINESS,
      targetId: "business-1",
    });
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it("sends push too when the setting is on", async () => {
    settingsService.getAdminNotificationSettings.mockResolvedValue({
      ...NOTIFICATION_SETTINGS,
      flaggedContentPushEnabled: true,
    });
    reportRepo.count.mockResolvedValue(3);
    await service.report("user-1", DTO);
    expect(pushService.sendToUsers).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({ url: "/admin/content/moderation" }),
    );
  });

  it("skips email when the setting is off", async () => {
    settingsService.getAdminNotificationSettings.mockResolvedValue({
      ...NOTIFICATION_SETTINGS,
      flaggedContentEmailEnabled: false,
    });
    reportRepo.count.mockResolvedValue(3);
    await service.report("user-1", DTO);
    expect(mailService.sendFlaggedContentAlert).not.toHaveBeenCalled();
    // Still gets the in-app notification — that's not gated by the toggle.
    expect(notificationsService.createMany).toHaveBeenCalled();
  });

  it("narrows recipients to the configured admin list instead of every admin", async () => {
    settingsService.getAdminNotificationSettings.mockResolvedValue({
      ...NOTIFICATION_SETTINGS,
      flaggedContentRecipientUserIds: ["admin-2"],
    });
    usersService.findByIds.mockResolvedValue([
      { id: "admin-2", name: "Admin Two", email: "admin2@example.com" },
    ]);
    reportRepo.count.mockResolvedValue(3);
    await service.report("user-1", DTO);
    expect(usersService.findByIds).toHaveBeenCalledWith(["admin-2"]);
    expect(usersService.findAdmins).not.toHaveBeenCalled();
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      ["admin-2"],
      expect.anything(),
    );
  });
});
