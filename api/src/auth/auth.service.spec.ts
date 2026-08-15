import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";
import { AuthProvider } from "../users/entities/user.enums";

describe("AuthService", () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    usersService = { findByEmail: jest.fn(), create: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue("signed.jwt.token") };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
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
      expect(result.accessToken).toBe("signed.jwt.token");
    });
  });
});
