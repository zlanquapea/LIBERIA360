import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { LoginActivityService } from "./login-activity.service";
import { LoginActivity } from "./entities/login-activity.entity";
import { User } from "../users/entities/user.entity";

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
  };
  let qb: {
    select: jest.Mock;
    where: jest.Mock;
    getRawMany: jest.Mock;
  };

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
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginActivityService,
        { provide: getRepositoryToken(LoginActivity), useValue: activityRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
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
