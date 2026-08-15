import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { authenticator } from "otplib";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { AuthProvider } from "../users/entities/user.enums";
import { encryptSecret } from "./two-factor-crypto";

// Same dev-only fallback key as configuration.ts's TWO_FACTOR_ENCRYPTION_KEY
// default — a valid 32-byte hex string, nothing more.
const TEST_TWO_FACTOR_KEY = "dead".repeat(16);

describe("AuthService", () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    create: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue("signed.jwt.token"),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue({ encryptionKey: TEST_TWO_FACTOR_KEY }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
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
  });
});

function encryptOnTestKey(secret: string): string {
  return encryptSecret(secret, TEST_TWO_FACTOR_KEY);
}
