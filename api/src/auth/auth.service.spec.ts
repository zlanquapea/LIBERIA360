import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { authenticator } from "otplib";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { MailService } from "../mail/mail.service";
import { LoginActivityService } from "../security/login-activity.service";
import { ItinerariesService } from "../itineraries/itineraries.service";
import { AuthProvider } from "../users/entities/user.enums";
import { encryptSecret } from "./two-factor-crypto";
import { hashToken } from "./token-hash";

// Same dev-only fallback key as configuration.ts's TWO_FACTOR_ENCRYPTION_KEY
// default — a valid 32-byte hex string, nothing more.
const TEST_TWO_FACTOR_KEY = "dead".repeat(16);

const CONFIG_BY_KEY: Record<string, unknown> = {
  twoFactor: { encryptionKey: TEST_TWO_FACTOR_KEY },
  webAppUrl: "http://localhost:3000",
};

describe("AuthService", () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
    findByTokenHash: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };
  let mailService: {
    sendEmailVerification: jest.Mock;
    sendPasswordReset: jest.Mock;
  };
  let loginActivityService: { record: jest.Mock };
  let itinerariesService: { linkInvitationToNewAccount: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn((id, data) => ({ id, ...data })),
      findByTokenHash: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue("signed.jwt.token"),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => CONFIG_BY_KEY[key]),
    };
    mailService = {
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };
    loginActivityService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    itinerariesService = {
      linkInvitationToNewAccount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
        { provide: LoginActivityService, useValue: loginActivityService },
        { provide: ItinerariesService, useValue: itinerariesService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe("register", () => {
    it("rejects a duplicate email without hashing or creating anything", async () => {
      usersService.findByEmail.mockResolvedValue({ id: "existing" });

      await expect(
        service.register({
          name: "X",
          email: "x@example.com",
          password: "password123",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it("hashes the password (never stores it plain) and returns a signed token", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (data) => ({
        id: "new-user",
        ...data,
        homeCounty: null,
        isAdmin: false,
        createdAt: new Date(),
      }));

      const result = await service.register({
        name: "X",
        email: "x@example.com",
        password: "password123",
      });

      const createCall = usersService.create.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe("password123");
      expect(await bcrypt.compare("password123", createCall.passwordHash)).toBe(
        true,
      );
      expect(createCall.authProvider).toBe(AuthProvider.EMAIL);

      expect(result.accessToken).toBe("signed.jwt.token");
      expect(result.user).not.toHaveProperty("passwordHash");
    });

    it("links an invite token to the new account when registering from an invite link", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (data) => ({
        id: "new-user",
        ...data,
        homeCounty: null,
        isAdmin: false,
        createdAt: new Date(),
      }));

      await service.register({
        name: "X",
        email: "x@example.com",
        password: "password123",
        inviteToken: "a".repeat(64),
      });

      expect(
        itinerariesService.linkInvitationToNewAccount,
      ).toHaveBeenCalledWith("a".repeat(64), "new-user");
    });

    it("never fails registration when linking the invite token throws", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (data) => ({
        id: "new-user",
        ...data,
        homeCounty: null,
        isAdmin: false,
        createdAt: new Date(),
      }));
      itinerariesService.linkInvitationToNewAccount.mockRejectedValue(
        new Error("boom"),
      );

      await expect(
        service.register({
          name: "X",
          email: "x@example.com",
          password: "password123",
          inviteToken: "a".repeat(64),
        }),
      ).resolves.toHaveProperty("accessToken");
    });
  });

  describe("login", () => {
    it("rejects an unknown email", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: "nobody@example.com", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects a wrong password without leaking whether the email exists", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      usersService.findByEmail.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        passwordHash,
      });

      await expect(
        service.login({ email: "x@example.com", password: "wrong-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("accepts the correct password and signs a token", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      usersService.findByEmail.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        passwordHash,
        homeCounty: null,
        isAdmin: false,
        createdAt: new Date(),
      });

      const result = await service.login({
        email: "x@example.com",
        password: "correct-password",
      });
      expect("accessToken" in result && result.accessToken).toBe(
        "signed.jwt.token",
      );
    });

    it("returns a pendingToken instead of an accessToken when 2FA is enabled", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      usersService.findByEmail.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        passwordHash,
        homeCounty: null,
        isAdmin: false,
        twoFactorEnabled: true,
        createdAt: new Date(),
      });

      const result = await service.login({
        email: "x@example.com",
        password: "correct-password",
      });
      expect(result).toEqual({
        twoFactorRequired: true,
        pendingToken: "signed.jwt.token",
      });
    });

    it("records a failed login-activity row for an unknown email", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: "nobody@example.com", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(loginActivityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          emailAttempted: "nobody@example.com",
          success: false,
          reason: "invalid_credentials",
        }),
      );
    });

    it("records a failed login-activity row for a wrong password, attributed to the real account", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      usersService.findByEmail.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        passwordHash,
      });
      await expect(
        service.login({ email: "x@example.com", password: "wrong-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(loginActivityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "1",
          success: false,
          reason: "invalid_credentials",
        }),
      );
    });

    it("records a successful login-activity row for a non-2FA account", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      usersService.findByEmail.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        passwordHash,
        homeCounty: null,
        isAdmin: false,
        createdAt: new Date(),
      });
      await service.login({
        email: "x@example.com",
        password: "correct-password",
      });
      expect(loginActivityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "1",
          success: true,
          reason: "success",
        }),
      );
    });

    it("does NOT record login-activity yet when 2FA is required — that's verifyTwoFactor's job", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      usersService.findByEmail.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        passwordHash,
        twoFactorEnabled: true,
      });
      await service.login({
        email: "x@example.com",
        password: "correct-password",
      });
      expect(loginActivityService.record).not.toHaveBeenCalled();
    });
  });

  describe("setupTwoFactor", () => {
    it("stores an encrypted secret and returns a QR code data URL", async () => {
      const user = { id: "1", email: "x@example.com" } as never;

      const result = await service.setupTwoFactor(user);

      expect(usersService.update).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ twoFactorSecret: expect.any(String) }),
      );
      // Not the plaintext secret returned to the caller — it must be
      // encrypted (iv:authTag:ciphertext) before it ever reaches the DB.
      const storedSecret = usersService.update.mock.calls[0][1].twoFactorSecret;
      expect(storedSecret).not.toBe(result.secret);
      expect(storedSecret.split(":")).toHaveLength(3);
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe("enableTwoFactor", () => {
    it("rejects an invalid code without enabling 2FA", async () => {
      const user = {
        id: "1",
        email: "x@example.com",
        twoFactorSecret: encryptOnTestKey(authenticator.generateSecret()),
      } as never;

      await expect(
        service.enableTwoFactor(user, "000000"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it("enables 2FA and returns recovery codes for a valid code", async () => {
      const secret = authenticator.generateSecret();
      const user = {
        id: "1",
        email: "x@example.com",
        twoFactorSecret: encryptOnTestKey(secret),
      } as never;

      const recoveryCodes = await service.enableTwoFactor(
        user,
        authenticator.generate(secret),
      );

      expect(recoveryCodes).toHaveLength(10);
      expect(usersService.update).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ twoFactorEnabled: true }),
      );
    });
  });

  describe("disableTwoFactor", () => {
    it("rejects the wrong password without touching 2FA state", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      const user = { id: "1", passwordHash } as never;

      await expect(
        service.disableTwoFactor(user, "wrong-password"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it("clears 2FA state given the correct password", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      const user = { id: "1", passwordHash } as never;

      await service.disableTwoFactor(user, "correct-password");

      expect(usersService.update).toHaveBeenCalledWith("1", {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: null,
      });
    });
  });

  describe("verifyTwoFactor", () => {
    it("rejects a malformed or expired pendingToken", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      await expect(
        service.verifyTwoFactor({ pendingToken: "bad", code: "123456" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("exchanges a valid TOTP code for a real accessToken", async () => {
      const secret = authenticator.generateSecret();
      jwtService.verify.mockReturnValue({ sub: "1", purpose: "2fa-pending" });
      usersService.findById.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        twoFactorEnabled: true,
        twoFactorSecret: encryptOnTestKey(secret),
        twoFactorRecoveryCodes: [],
      });

      const result = await service.verifyTwoFactor({
        pendingToken: "pending.jwt",
        code: authenticator.generate(secret),
      });

      expect(result.accessToken).toBe("signed.jwt.token");
    });

    it("consumes a matching recovery code exactly once", async () => {
      const recoveryCode = "abcde-12345";
      const hash = await bcrypt.hash(recoveryCode, 12);
      jwtService.verify.mockReturnValue({ sub: "1", purpose: "2fa-pending" });
      usersService.findById.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        twoFactorEnabled: true,
        twoFactorSecret: encryptOnTestKey(authenticator.generateSecret()),
        twoFactorRecoveryCodes: [hash],
      });

      const result = await service.verifyTwoFactor({
        pendingToken: "pending.jwt",
        code: recoveryCode,
      });

      expect(result.accessToken).toBe("signed.jwt.token");
      expect(usersService.update).toHaveBeenCalledWith("1", {
        twoFactorRecoveryCodes: [],
      });
    });

    it("rejects an invalid TOTP code and an invalid recovery code alike", async () => {
      jwtService.verify.mockReturnValue({ sub: "1", purpose: "2fa-pending" });
      usersService.findById.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        twoFactorEnabled: true,
        twoFactorSecret: encryptOnTestKey(authenticator.generateSecret()),
        twoFactorRecoveryCodes: [],
      });

      await expect(
        service.verifyTwoFactor({
          pendingToken: "pending.jwt",
          code: "000000",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("records a successful login-activity row for a valid TOTP code", async () => {
      const secret = authenticator.generateSecret();
      jwtService.verify.mockReturnValue({ sub: "1", purpose: "2fa-pending" });
      usersService.findById.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        twoFactorEnabled: true,
        twoFactorSecret: encryptOnTestKey(secret),
        twoFactorRecoveryCodes: [],
      });

      await service.verifyTwoFactor({
        pendingToken: "pending.jwt",
        code: authenticator.generate(secret),
      });

      expect(loginActivityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "1",
          emailAttempted: "x@example.com",
          success: true,
          reason: "success",
        }),
      );
    });

    it("records a failed login-activity row for an invalid code", async () => {
      jwtService.verify.mockReturnValue({ sub: "1", purpose: "2fa-pending" });
      usersService.findById.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        twoFactorEnabled: true,
        twoFactorSecret: encryptOnTestKey(authenticator.generateSecret()),
        twoFactorRecoveryCodes: [],
      });

      await expect(
        service.verifyTwoFactor({
          pendingToken: "pending.jwt",
          code: "000000",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(loginActivityService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "1",
          success: false,
          reason: "invalid_2fa_code",
        }),
      );
    });
  });

  describe("forgotPassword", () => {
    it("silently no-ops for an unknown email — never reveals whether an account exists", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await service.forgotPassword("nobody@example.com");
      expect(usersService.update).not.toHaveBeenCalled();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });

    it("stores a hashed reset token and emails a reset link for a real account", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: "1",
        email: "x@example.com",
        passwordHash: "hash",
      });

      await service.forgotPassword("x@example.com");

      expect(usersService.update).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          passwordResetTokenHash: expect.any(String),
          passwordResetTokenExpiresAt: expect.any(Date),
        }),
      );
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        "x@example.com",
        expect.stringContaining("/reset-password?token="),
      );
    });
  });

  describe("resetPassword", () => {
    it("rejects an unknown or already-used token", async () => {
      usersService.findByTokenHash.mockResolvedValue(null);
      await expect(
        service.resetPassword("bad-token", "newpassword123"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an expired token", async () => {
      const token = "a-real-token";
      usersService.findByTokenHash.mockResolvedValue({
        id: "1",
        tokenVersion: 0,
        passwordResetTokenHash: hashToken(token),
        passwordResetTokenExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword(token, "newpassword123"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("sets a new password, clears the token, and bumps tokenVersion", async () => {
      const token = "a-real-token";
      usersService.findByTokenHash.mockResolvedValue({
        id: "1",
        tokenVersion: 3,
        passwordResetTokenHash: hashToken(token),
        passwordResetTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      await service.resetPassword(token, "newpassword123");

      const updateCall = usersService.update.mock.calls[0];
      expect(updateCall[0]).toBe("1");
      expect(updateCall[1].passwordResetTokenHash).toBeNull();
      expect(updateCall[1].tokenVersion).toBe(4);
      expect(
        await bcrypt.compare("newpassword123", updateCall[1].passwordHash),
      ).toBe(true);
    });
  });

  describe("verifyEmail", () => {
    it("rejects an unknown or expired token", async () => {
      usersService.findByTokenHash.mockResolvedValue(null);
      await expect(service.verifyEmail("bad-token")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("marks the account verified and clears the token", async () => {
      const token = "verify-token";
      usersService.findByTokenHash.mockResolvedValue({
        id: "1",
        emailVerificationTokenHash: hashToken(token),
        emailVerificationTokenExpiresAt: new Date(Date.now() + 60_000),
      });

      await service.verifyEmail(token);

      expect(usersService.update).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          emailVerified: true,
          emailVerificationTokenHash: null,
        }),
      );
    });
  });

  describe("resendVerification", () => {
    it("no-ops for an already-verified account", async () => {
      await service.resendVerification({
        id: "1",
        emailVerified: true,
      } as never);
      expect(usersService.update).not.toHaveBeenCalled();
      expect(mailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it("issues a new token and resends for an unverified account", async () => {
      await service.resendVerification({
        id: "1",
        email: "x@example.com",
        emailVerified: false,
      } as never);
      expect(usersService.update).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({
          emailVerificationTokenHash: expect.any(String),
        }),
      );
      expect(mailService.sendEmailVerification).toHaveBeenCalled();
    });
  });

  describe("changePassword", () => {
    it("rejects the wrong current password", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      const user = { id: "1", passwordHash, tokenVersion: 0 } as never;
      await expect(
        service.changePassword(user, "wrong-password", "newpassword123"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it("sets the new password and bumps tokenVersion, returning a fresh token", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      const user = { id: "1", passwordHash, tokenVersion: 2 } as never;

      const result = await service.changePassword(
        user,
        "correct-password",
        "newpassword123",
      );

      expect(usersService.update).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ tokenVersion: 3 }),
      );
      expect(result.accessToken).toBe("signed.jwt.token");
    });
  });

  describe("logoutAllDevices", () => {
    it("bumps tokenVersion and returns a fresh token", async () => {
      const user = { id: "1", tokenVersion: 5 } as never;
      const result = await service.logoutAllDevices(user);
      expect(usersService.update).toHaveBeenCalledWith("1", {
        tokenVersion: 6,
      });
      expect(result.accessToken).toBe("signed.jwt.token");
    });
  });

  describe("revokeSessions", () => {
    it("rejects an unknown user", async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(service.revokeSessions("nonexistent")).rejects.toThrow();
    });

    it("bumps the target user's tokenVersion without needing their password", async () => {
      usersService.findById.mockResolvedValue({ id: "1", tokenVersion: 5 });
      await service.revokeSessions("1");
      expect(usersService.update).toHaveBeenCalledWith("1", {
        tokenVersion: 6,
      });
    });
  });

  describe("deleteAccount", () => {
    it("rejects the wrong password without touching the account", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      const user = { id: "1", passwordHash, tokenVersion: 0 } as never;
      await expect(
        service.deleteAccount(user, "wrong-password"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it("anonymizes the account and bumps tokenVersion given the correct password", async () => {
      const passwordHash = await bcrypt.hash("correct-password", 12);
      const user = { id: "1", passwordHash, tokenVersion: 1 } as never;

      await service.deleteAccount(user, "correct-password");

      const updateCall = usersService.update.mock.calls[0];
      expect(updateCall[0]).toBe("1");
      expect(updateCall[1]).toMatchObject({
        name: "Deleted user",
        passwordHash: null,
        phone: null,
        isAdmin: false,
        isSuperAdmin: false,
        tokenVersion: 2,
      });
      expect(updateCall[1].email).toMatch(
        /^deleted-.+@deleted\.liberia360\.invalid$/,
      );
      expect(updateCall[1].deletedAt).toBeInstanceOf(Date);
    });
  });
});

function encryptOnTestKey(secret: string): string {
  return encryptSecret(secret, TEST_TWO_FACTOR_KEY);
}
