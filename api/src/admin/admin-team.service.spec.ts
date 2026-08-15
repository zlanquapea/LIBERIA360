import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminTeamService } from "./admin-team.service";
import { User } from "../users/entities/user.entity";

describe("AdminTeamService", () => {
  let service: AdminTeamService;
  let userRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn((u) => u),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTeamService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(AdminTeamService);
  });

  describe("search", () => {
    it("rejects an unknown email", async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.search("nobody@example.com")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("lowercases the email before looking up (same convention as login)", async () => {
      userRepo.findOne.mockResolvedValue({ id: "1", email: "x@example.com" });
      await service.search("X@Example.com");
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: "x@example.com" },
      });
    });
  });

  describe("setRoles", () => {
    it("rejects a super admin removing their own super-admin access", async () => {
      await expect(
        service.setRoles("admin-1", "admin-1", {
          isAdmin: true,
          isSuperAdmin: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it("allows a super admin to touch their own record as long as isSuperAdmin stays true", async () => {
      userRepo.findOne.mockResolvedValue({
        id: "admin-1",
        isAdmin: true,
        isSuperAdmin: true,
      });
      await service.setRoles("admin-1", "admin-1", {
        isAdmin: true,
        isSuperAdmin: true,
      });
      expect(userRepo.save).toHaveBeenCalled();
    });

    it("rejects an unknown target user", async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.setRoles("admin-1", "nobody", {
          isAdmin: true,
          isSuperAdmin: false,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("forces isAdmin true when granting isSuperAdmin, even if the caller didn't set it", async () => {
      userRepo.findOne.mockResolvedValue({
        id: "target",
        isAdmin: false,
        isSuperAdmin: false,
      });
      const result = await service.setRoles("admin-1", "target", {
        isAdmin: false,
        isSuperAdmin: true,
      });
      expect(result.isAdmin).toBe(true);
      expect(result.isSuperAdmin).toBe(true);
    });

    it("demotes a plain admin back to a regular user", async () => {
      userRepo.findOne.mockResolvedValue({
        id: "target",
        isAdmin: true,
        isSuperAdmin: false,
      });
      const result = await service.setRoles("admin-1", "target", {
        isAdmin: false,
        isSuperAdmin: false,
      });
      expect(result.isAdmin).toBe(false);
      expect(result.isSuperAdmin).toBe(false);
    });
  });
});
