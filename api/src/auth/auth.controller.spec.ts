import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";

// The session cookie's Max-Age used to be a hardcoded 7 days, independent
// of JWT_EXPIRES_IN — see establishSession()'s doc comment. These pin the
// fix: the cookie's lifetime must always come from the token it carries.
describe("AuthController — session cookie lifetime", () => {
  let controller: AuthController;
  let authService: { register: jest.Mock };
  let jwtService: { decode: jest.Mock };
  let res: { cookie: jest.Mock; setHeader: jest.Mock };

  beforeEach(async () => {
    authService = { register: jest.fn() };
    jwtService = { decode: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UsersService, useValue: {} },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    controller = module.get(AuthController);
    res = { cookie: jest.fn(), setHeader: jest.fn() };
  });

  function registerWith(accessToken: string) {
    authService.register.mockResolvedValue({
      accessToken,
      user: { id: "u1" },
    });
    return controller.register(
      { name: "A", email: "a@example.com", password: "password123" },
      res as unknown as Response,
    );
  }

  it("sizes the cookie to a short-lived token's own exp claim, not 7 days", async () => {
    const now = Date.now();
    jwtService.decode.mockReturnValue({
      exp: Math.floor(now / 1000) + 60 * 60, // 1 hour from now
    });

    await registerWith("short-lived-token");

    expect(jwtService.decode).toHaveBeenCalledWith("short-lived-token");
    const [, , options] = res.cookie.mock.calls[0] as [
      string,
      string,
      { maxAge: number },
    ];
    // Allow a little slack for time elapsed during the test itself.
    expect(options.maxAge).toBeGreaterThan(59 * 60 * 1000);
    expect(options.maxAge).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("sizes the cookie to a long-lived token's exp claim, not capped at 7 days", async () => {
    const now = Date.now();
    const thirtyDaysSeconds = 30 * 24 * 60 * 60;
    jwtService.decode.mockReturnValue({
      exp: Math.floor(now / 1000) + thirtyDaysSeconds,
    });

    await registerWith("long-lived-token");

    const [, , options] = res.cookie.mock.calls[0] as [
      string,
      string,
      { maxAge: number },
    ];
    expect(options.maxAge).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
  });

  it("falls back to 7 days if the token is somehow undecodable", async () => {
    jwtService.decode.mockReturnValue(null);

    await registerWith("unreadable-token");

    const [, , options] = res.cookie.mock.calls[0] as [
      string,
      string,
      { maxAge: number },
    ];
    expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
