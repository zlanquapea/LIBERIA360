import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { MailService } from "../src/mail/mail.service";
import { sessionCookie } from "./helpers/session-cookie";

// Full HTTP round-trip through the account-lifecycle endpoints added for
// production readiness: email verification, password reset, change
// password, "sign out of all other devices", and account deletion.
// MailService is overridden with a spy rather than really sending mail —
// the verification/reset tokens are only ever available via the link
// passed to it (the raw token is hashed before it's stored — see
// auth/token-hash.ts — so there's no way to recover it from the DB, by
// design). Self-contained, own reset, own app instance — same reasoning
// as two-factor.e2e-spec.ts for why this is a separate file rather than
// folded into phase2.e2e-spec.ts's Auth block.
describe("Auth lifecycle (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let mailService: {
    sendEmailVerification: jest.Mock;
    sendPasswordReset: jest.Mock;
  };

  function tokenFromUrl(url: string): string {
    return new URL(url).searchParams.get("token")!;
  }

  beforeAll(async () => {
    mailService = {
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    await dataSource.runMigrations();
    await dataSource.query("TRUNCATE TABLE users RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Email verification", () => {
    it("sends a verification email at registration and lets it be confirmed exactly once", async () => {
      const email = "verify-user@example.com";
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "Verify User", email, password: "password123" })
        .expect(201);

      expect(mailService.sendEmailVerification).toHaveBeenCalledWith(
        email,
        expect.stringContaining("/verify-email?token="),
      );
      const token = tokenFromUrl(
        mailService.sendEmailVerification.mock.calls[0][1],
      );

      await request(app.getHttpServer())
        .post("/api/v1/auth/verify-email")
        .send({ token: "wrong-token" })
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/auth/verify-email")
        .send({ token })
        .expect(200);

      // Already-used token is rejected on a second attempt.
      await request(app.getHttpServer())
        .post("/api/v1/auth/verify-email")
        .send({ token })
        .expect(401);

      const login = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "password123" })
        .expect(200);
      expect(login.body.user.emailVerified).toBe(true);
    });

    it("resend-verification issues a new token, and no-ops once already verified", async () => {
      const email = "resend-user@example.com";
      const register = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "Resend User", email, password: "password123" })
        .expect(201);
      const accessToken = sessionCookie(register);

      mailService.sendEmailVerification.mockClear();
      await request(app.getHttpServer())
        .post("/api/v1/auth/resend-verification")
        .set("Cookie", accessToken)
        .expect(200);
      expect(mailService.sendEmailVerification).toHaveBeenCalledTimes(1);
      const token = tokenFromUrl(
        mailService.sendEmailVerification.mock.calls[0][1],
      );

      await request(app.getHttpServer())
        .post("/api/v1/auth/verify-email")
        .send({ token })
        .expect(200);

      mailService.sendEmailVerification.mockClear();
      await request(app.getHttpServer())
        .post("/api/v1/auth/resend-verification")
        .set("Cookie", accessToken)
        .expect(200);
      expect(mailService.sendEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe("Password reset", () => {
    it("resets a forgotten password and invalidates every session issued before the reset", async () => {
      const email = "reset-user@example.com";
      const register = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "Reset User", email, password: "old-password-123" })
        .expect(201);
      const oldToken = sessionCookie(register);

      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", oldToken)
        .expect(200);

      const forgot = await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({ email })
        .expect(200);
      expect(forgot.body.message).toMatch(/if an account exists/i);

      const resetToken = tokenFromUrl(
        mailService.sendPasswordReset.mock.calls[0][1],
      );

      await request(app.getHttpServer())
        .post("/api/v1/auth/reset-password")
        .send({ token: "bad-token", newPassword: "new-password-123" })
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/auth/reset-password")
        .send({ token: resetToken, newPassword: "new-password-123" })
        .expect(200);

      // The session that existed before the reset is dead — tokenVersion
      // moved on, exactly the point of resetting a possibly-compromised
      // account's password.
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", oldToken)
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "old-password-123" })
        .expect(401);
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email, password: "new-password-123" })
        .expect(200);
    });

    it("responds identically whether or not the email is registered", async () => {
      const unknown = await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({ email: "definitely-not-registered@example.com" })
        .expect(200);
      const known = await request(app.getHttpServer())
        .post("/api/v1/auth/forgot-password")
        .send({ email: "reset-user@example.com" })
        .expect(200);
      expect(unknown.body.message).toBe(known.body.message);
    });
  });

  describe("Change password, sign-out-everywhere, and account deletion", () => {
    let email: string;
    let password: string;
    let accessToken: string;

    beforeAll(async () => {
      email = "lifecycle-user@example.com";
      password = "password123";
      const register = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "Lifecycle User", email, password })
        .expect(201);
      accessToken = sessionCookie(register);
    });

    it("rejects a password change with the wrong current password", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/auth/password")
        .set("Cookie", accessToken)
        .send({ currentPassword: "wrong", newPassword: "newpassword123" })
        .expect(401);
    });

    it("changes the password, invalidates the old token, and hands back a fresh one", async () => {
      const change = await request(app.getHttpServer())
        .patch("/api/v1/auth/password")
        .set("Cookie", accessToken)
        .send({ currentPassword: password, newPassword: "newpassword123" })
        .expect(200);

      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", accessToken)
        .expect(401);

      accessToken = sessionCookie(change);
      password = "newpassword123";
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", accessToken)
        .expect(200);
    });

    it("logout-all invalidates even the calling session's old token, replacing it with a fresh one", async () => {
      const oldToken = accessToken;
      const result = await request(app.getHttpServer())
        .post("/api/v1/auth/logout-all")
        .set("Cookie", oldToken)
        .expect(200);

      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", oldToken)
        .expect(401);

      accessToken = sessionCookie(result);
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", accessToken)
        .expect(200);
    });

    it("rejects account deletion with the wrong password", async () => {
      await request(app.getHttpServer())
        .delete("/api/v1/auth/me")
        .set("Cookie", accessToken)
        .send({ password: "wrong" })
        .expect(401);
    });

    it("deletes (anonymizes) the account — the old token stops working and the email is free again", async () => {
      await request(app.getHttpServer())
        .delete("/api/v1/auth/me")
        .set("Cookie", accessToken)
        .send({ password })
        .expect(200);

      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Cookie", accessToken)
        .expect(401);

      // The email is genuinely free — a new registration with the exact
      // same address succeeds, proving the row was anonymized in place
      // rather than left holding the unique email constraint hostage.
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "New Owner", email, password: "brand-new-pass-123" })
        .expect(201);
    });
  });
});
