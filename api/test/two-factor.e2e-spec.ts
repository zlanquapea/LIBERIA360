import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { authenticator } from "otplib";
import { AppModule } from "../src/app.module";
import { expectNoSessionCookie, sessionCookie } from "./helpers/session-cookie";

// Full HTTP round-trip through the 2FA endpoints. Deliberately keeps the
// number of POST /auth/login and POST /auth/2fa/verify calls low (a
// pendingToken can be reused for multiple verify attempts, since it's not
// invalidated on a failed attempt) — both endpoints are rate-limited to 5
// requests/minute/IP (see app.module.ts), and this file's own throttler
// storage would otherwise start returning 429 mid-test. Rate limiting
// itself is covered separately in rate-limiting.e2e-spec.ts, which gets a
// fresh app/storage so it doesn't have to share this budget.
describe("Two-factor authentication (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  it("walks the full setup → enable → login → verify → recovery → disable flow", async () => {
    const email = "2fa-user@example.com";
    const password = "correct-password-123";

    // Register — gets a real session cookie, 2FA not enabled yet.
    const register = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name: "2FA User", email, password })
      .expect(201);
    const accessToken = sessionCookie(register);
    expect(register.body.user.twoFactorEnabled).toBe(false);

    // Setup — generates a secret + QR code, doesn't enable anything yet.
    const setup = await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/setup")
      .set("Cookie", accessToken)
      .expect(201);
    expect(setup.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    const secret = setup.body.secret as string;

    // Enable — wrong code is rejected, nothing is enabled.
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/enable")
      .set("Cookie", accessToken)
      .send({ code: "000000" })
      .expect(401);

    // Enable — real code turns 2FA on and hands back recovery codes once.
    const enable = await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/enable")
      .set("Cookie", accessToken)
      .send({ code: authenticator.generate(secret) })
      .expect(201);
    const recoveryCodes = enable.body.recoveryCodes as string[];
    expect(recoveryCodes).toHaveLength(10);

    const me = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Cookie", accessToken)
      .expect(200);
    expect(me.body.twoFactorEnabled).toBe(true);

    // Login now returns a pendingToken instead of a real session.
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    expect(login.body.twoFactorRequired).toBe(true);
    expectNoSessionCookie(login);
    const pendingToken = login.body.pendingToken as string;

    // The pendingToken proves the password step passed, nothing more — it
    // must not work as a bearer token against an ordinary protected route.
    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${pendingToken}`)
      .expect(401);

    // Verify — wrong code is rejected.
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ pendingToken, code: "000000" })
      .expect(401);

    // Verify — the real TOTP code exchanges the pendingToken for a real
    // session.
    const verify = await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ pendingToken, code: authenticator.generate(secret) })
      .expect(200);
    sessionCookie(verify);
    expect(verify.body.user.email).toBe(email);

    // A recovery code works exactly once — reusing the same pendingToken
    // is fine (it isn't single-use), but the recovery code itself is.
    const recoveryCode = recoveryCodes[0];
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ pendingToken, code: recoveryCode })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ pendingToken, code: recoveryCode })
      .expect(401);

    // Disable — wrong password is rejected, 2FA stays on.
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/disable")
      .set("Cookie", accessToken)
      .send({ password: "wrong-password" })
      .expect(401);

    // Disable — correct password turns 2FA off.
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/disable")
      .set("Cookie", accessToken)
      .send({ password })
      .expect(200);

    // Login is a normal single-step flow again.
    const loginAfterDisable = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password })
      .expect(200);
    sessionCookie(loginAfterDisable);
    expect(loginAfterDisable.body.twoFactorRequired).toBeUndefined();
    // bcrypt (12 rounds) runs a dozen-plus times in this one test — hashing
    // the password, 10 recovery codes, and comparing several more — well
    // past Jest's 5s default.
  }, 20000);

  it("rejects a pendingToken from a stale/expired login session", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ pendingToken: "not-a-real-token", code: "123456" })
      .expect(401);
  });

  it("rejects /auth/2fa/setup and /auth/2fa/enable without a token", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/setup")
      .expect(401);
    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/enable")
      .send({ code: "123456" })
      .expect(401);
  });
});
