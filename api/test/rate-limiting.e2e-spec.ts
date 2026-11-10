import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { CLIENT_IP_HEADER, PROXY_SECRET_HEADER } from "../src/common/client-ip";

// What the web service presents alongside the visitor address it forwards
// (see src/common/client-ip.ts) — set before the app boots, like a real
// deployment's env var.
const PROXY_SECRET = "e2e-internal-proxy-secret-0123456789abcdef";

// Gets its own app instance (and therefore its own in-memory throttler
// storage) so its login/verify attempts don't share a budget with
// two-factor.e2e-spec.ts, which needs its own handful of calls to those
// same rate-limited endpoints to succeed.
describe("Rate limiting (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.INTERNAL_PROXY_SECRET = PROXY_SECRET;
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

  it("blocks POST /auth/login after 5 attempts within a minute", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "nobody@example.com", password: "wrong" })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "wrong" })
      .expect(429);
  });

  it("blocks POST /auth/2fa/verify after 5 attempts within a minute", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post("/api/v1/auth/2fa/verify")
        .send({ pendingToken: "not-a-real-token", code: "123456" })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post("/api/v1/auth/2fa/verify")
      .send({ pendingToken: "not-a-real-token", code: "123456" })
      .expect(429);
  });

  it("does not throttle GET /api/v1/counties nearly as tightly (global default)", async () => {
    for (let i = 0; i < 20; i++) {
      await request(app.getHttpServer()).get("/api/v1/counties").expect(200);
    }
  });

  // Everything below pins the fix for the whole site sharing one budget:
  // in production every request reaches the API from the web service's
  // address, so the throttler has to key on the visitor address the web
  // service forwards (trusted only with the shared secret) instead.
  describe("behind the web service", () => {
    const asVisitor = (ip: string) => ({
      [CLIENT_IP_HEADER]: ip,
      [PROXY_SECRET_HEADER]: PROXY_SECRET,
    });

    it("gives each visitor their own budget on the global default", async () => {
      // 30 visitors x 5 requests = 150 through one connecting address —
      // more than the 120/min a single address is allowed.
      for (let visitor = 1; visitor <= 30; visitor++) {
        for (let i = 0; i < 5; i++) {
          await request(app.getHttpServer())
            .get("/api/v1/categories")
            .set(asVisitor(`198.51.100.${visitor}`))
            .expect(200);
        }
      }
    });

    it("still limits a burst from one visitor", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 125; i++) {
        const res = await request(app.getHttpServer())
          .get("/api/v1/categories")
          .set(asVisitor("198.51.100.200"));
        statuses.push(res.status);
      }
      expect(statuses.filter((s) => s === 200)).toHaveLength(120);
      expect(statuses.filter((s) => s === 429)).toHaveLength(5);

      // ...without spending anyone else's budget.
      await request(app.getHttpServer())
        .get("/api/v1/categories")
        .set(asVisitor("198.51.100.201"))
        .expect(200);
    });

    it("keeps the strict password-reset limit per visitor", async () => {
      const attempt = (ip: string) =>
        request(app.getHttpServer())
          .post("/api/v1/auth/forgot-password")
          .set(asVisitor(ip))
          .send({ email: "nobody@example.com" });

      for (let i = 0; i < 5; i++) {
        expect((await attempt("203.0.113.10")).status).not.toBe(429);
      }
      expect((await attempt("203.0.113.10")).status).toBe(429);
      // One visitor hammering the endpoint must not lock out another.
      expect((await attempt("203.0.113.11")).status).not.toBe(429);
    });

    it("ignores a forwarded address that does not come with the shared secret", async () => {
      // A caller reaching the API directly can't rotate a made-up address
      // to dodge the limit: without the secret every attempt is counted
      // against the address it actually connected from.
      const attempt = (i: number, secret?: string) => {
        const req = request(app.getHttpServer())
          .post("/api/v1/auth/reset-password")
          .set(CLIENT_IP_HEADER, `192.0.2.${i + 1}`);
        if (secret) req.set(PROXY_SECRET_HEADER, secret);
        return req.send({
          token: "not-a-real-token",
          newPassword: "irrelevant-123",
        });
      };

      for (let i = 0; i < 5; i++) {
        expect(
          (await attempt(i, i % 2 ? "wrong-secret" : undefined)).status,
        ).not.toBe(429);
      }
      expect((await attempt(5)).status).toBe(429);
      expect((await attempt(6, "wrong-secret")).status).toBe(429);
    });
  });
});
