import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminAuditService } from "./admin-audit.service";
import { AdminAction } from "./entities/admin-action.entity";

describe("AdminAuditService", () => {
  let service: AdminAuditService;
  let actionRepo: {
    save: jest.Mock;
    create: jest.Mock;
    findAndCount: jest.Mock;
  };

  beforeEach(async () => {
    actionRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((data) => data),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuditService,
        { provide: getRepositoryToken(AdminAction), useValue: actionRepo },
      ],
    }).compile();

    service = module.get(AdminAuditService);
  });

  describe("log", () => {
    it("saves an action with the given fields, defaulting metadata and request info to null", async () => {
      await service.log("admin-1", "place.verification_changed", "place", "p1");
      expect(actionRepo.save).toHaveBeenCalledWith({
        adminUserId: "admin-1",
        action: "place.verification_changed",
        targetType: "place",
        targetId: "p1",
        metadata: null,
        ipAddress: null,
        userAgent: null,
      });
    });

    it("passes metadata through when provided", async () => {
      await service.log("admin-1", "admin_team.roles_changed", "user", "u1", {
        from: { isAdmin: false },
        to: { isAdmin: true },
      });
      expect(actionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { from: { isAdmin: false }, to: { isAdmin: true } },
        }),
      );
    });

    it("passes request info (ip/user-agent) through when provided", async () => {
      await service.log(
        "admin-1",
        "admin_team.roles_changed",
        "user",
        "u1",
        undefined,
        { ipAddress: "203.0.113.5", userAgent: "Mozilla/5.0" },
      );
      expect(actionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "203.0.113.5",
          userAgent: "Mozilla/5.0",
        }),
      );
    });

    it("swallows a save failure instead of throwing, so a logging hiccup never fails the calling action", async () => {
      actionRepo.save.mockRejectedValue(new Error("connection reset"));
      await expect(
        service.log("admin-1", "place.verification_changed", "place", "p1"),
      ).resolves.toBeUndefined();
    });
  });

  describe("findAll", () => {
    it("paginates using the given page/limit and orders by createdAt DESC", async () => {
      actionRepo.findAndCount.mockResolvedValue([[{ id: "a1" }], 45]);
      const result = await service.findAll(2, 20);
      expect(actionRepo.findAndCount).toHaveBeenCalledWith({
        order: { createdAt: "DESC" },
        skip: 20,
        take: 20,
      });
      expect(result).toEqual({
        data: [{ id: "a1" }],
        meta: { total: 45, page: 2, limit: 20, totalPages: 3 },
      });
    });

    it("returns totalPages 1 for an empty result set", async () => {
      actionRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll(1, 20);
      expect(result.meta.totalPages).toBe(1);
    });
  });
});
