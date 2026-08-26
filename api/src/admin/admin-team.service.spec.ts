import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { AdminTeamService } from "./admin-team.service";
import { User } from "../users/entities/user.entity";
import { AdminAuditService } from "./admin-audit.service";
import { MailService } from "../mail/mail.service";

describe("AdminTeamService", () => {
  let service: AdminTeamService;
  let userRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let adminAuditService: { log: jest.Mock };
  let mailService: { sendAdminInvite: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn((u) => u),
      create: jest.fn((u) => u),
      createQueryBuilder: jest.fn(),
    };
    adminAuditService = { log: jest.fn() };
    mailService = { sendAdminInvite: jest.fn().mockResolvedValue(undefined) };
    configService = { get: jest.fn(() => "https://liberia360.example") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTeamService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: AdminAuditService, useValue: adminAuditService },
        { provide: MailService, useValue: mailService },
        { provide: ConfigService, useValue: configService },
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

    it("records the role change with before/after roles in the audit log", async () => {
      userRepo.findOne.mockResolvedValue({
        id: "target",
        isAdmin: false,
        isSuperAdmin: false,
      });
      await service.setRoles("admin-1", "target", {
        isAdmin: true,
        isSuperAdmin: false,
      });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "admin_team.roles_changed",
        "user",
        "target",
        {
          from: { isAdmin: false, isSuperAdmin: false },
          to: { isAdmin: true, isSuperAdmin: false },
        },
        undefined,
      );
    });

    it("does not record anything when rejecting a self-demotion", async () => {
      await expect(
        service.setRoles("admin-1", "admin-1", {
          isAdmin: true,
          isSuperAdmin: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(adminAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe("createAdmin", () => {
    it("rejects an email that already has an activated account", async () => {
      userRepo.findOne.mockResolvedValue({
        id: "existing",
        email: "taken@example.com",
        passwordHash: "some-bcrypt-hash",
      });
      await expect(
        service.createAdmin("admin-1", "Ada", {
          name: "New Person",
          email: "taken@example.com",
          isSuperAdmin: false,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(mailService.sendAdminInvite).not.toHaveBeenCalled();
    });

    it("re-invites in place instead of conflicting when the email belongs to a pending, never-activated invite", async () => {
      const pending = {
        id: "pending-1",
        name: "Old Name",
        email: "invitee@example.com",
        passwordHash: null,
        isAdmin: false,
        isSuperAdmin: false,
      };
      userRepo.findOne.mockResolvedValue(pending);
      const result = await service.createAdmin("admin-1", "Ada", {
        name: "New Name",
        email: "invitee@example.com",
        isSuperAdmin: true,
      });

      expect(result.name).toBe("New Name");
      expect(result.isAdmin).toBe(true);
      expect(result.isSuperAdmin).toBe(true);
      expect(mailService.sendAdminInvite).toHaveBeenCalledTimes(1);
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "admin_team.created",
        "user",
        "pending-1",
        expect.objectContaining({ name: "New Name", isSuperAdmin: true }),
        undefined,
      );
    });

    it("creates a plain admin with no password and a fresh reset token", async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.createAdmin("admin-1", "Ada", {
        name: "New Person",
        email: "New@Example.com",
        isSuperAdmin: false,
      });

      expect(result.email).toBe("new@example.com");
      expect(result.passwordHash).toBeNull();
      expect(result.isAdmin).toBe(true);
      expect(result.isSuperAdmin).toBe(false);
      expect(result.passwordResetTokenHash).toEqual(expect.any(String));
      expect(result.passwordResetTokenExpiresAt).toBeInstanceOf(Date);
    });

    it("grants isAdmin alongside isSuperAdmin when creating a super admin", async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.createAdmin("admin-1", "Ada", {
        name: "New Super",
        email: "newsuper@example.com",
        isSuperAdmin: true,
      });
      expect(result.isAdmin).toBe(true);
      expect(result.isSuperAdmin).toBe(true);
    });

    it("emails the new admin a set-password link built from the reset token", async () => {
      userRepo.findOne.mockResolvedValue(null);
      await service.createAdmin("admin-1", "Ada", {
        name: "New Person",
        email: "newadmin@example.com",
        isSuperAdmin: false,
      });

      expect(mailService.sendAdminInvite).toHaveBeenCalledTimes(1);
      const [to, name, grantedByName, isSuperAdmin, setPasswordUrl] =
        mailService.sendAdminInvite.mock.calls[0];
      expect(to).toBe("newadmin@example.com");
      expect(name).toBe("New Person");
      expect(grantedByName).toBe("Ada");
      expect(isSuperAdmin).toBe(false);
      expect(setPasswordUrl).toMatch(
        /^https:\/\/liberia360\.example\/reset-password\?token=.+/,
      );
    });

    it("never lets a failed invite email fail account creation", async () => {
      userRepo.findOne.mockResolvedValue(null);
      mailService.sendAdminInvite.mockRejectedValue(new Error("smtp down"));
      await expect(
        service.createAdmin("admin-1", "Ada", {
          name: "New Person",
          email: "newadmin@example.com",
          isSuperAdmin: false,
        }),
      ).resolves.toBeDefined();
    });

    it("records the creation in the audit log", async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.createAdmin("admin-1", "Ada", {
        name: "New Person",
        email: "newadmin@example.com",
        isSuperAdmin: true,
      });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "admin_team.created",
        "user",
        result.id,
        {
          name: "New Person",
          email: "newadmin@example.com",
          isSuperAdmin: true,
        },
        undefined,
      );
    });
  });

  describe("resendInvite", () => {
    it("rejects an unknown user", async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resendInvite("admin-1", "Ada", "nobody"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects once the account has already set a password", async () => {
      userRepo.findOne.mockResolvedValue({
        id: "u1",
        name: "Ada",
        passwordHash: "some-bcrypt-hash",
      });
      await expect(
        service.resendInvite("admin-1", "Ada", "u1"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mailService.sendAdminInvite).not.toHaveBeenCalled();
    });

    it("resends with a fresh token, leaving name and role untouched", async () => {
      const pending = {
        id: "u1",
        name: "Nyema",
        email: "nyema@example.com",
        passwordHash: null,
        isAdmin: true,
        isSuperAdmin: false,
      };
      userRepo.findOne.mockResolvedValue(pending);
      const result = await service.resendInvite("admin-1", "Ada", "u1");

      expect(result.name).toBe("Nyema");
      expect(result.isSuperAdmin).toBe(false);
      expect(mailService.sendAdminInvite).toHaveBeenCalledWith(
        "nyema@example.com",
        "Nyema",
        "Ada",
        false,
        expect.stringContaining("reset-password?token="),
      );
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "admin_team.invite_resent",
        "user",
        "u1",
        expect.any(Object),
        undefined,
      );
    });
  });
});
