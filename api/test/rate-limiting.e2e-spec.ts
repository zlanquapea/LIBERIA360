import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";

// Gets its own app instance (and therefore its own in-memory throttler
// storage) so its login/verify attempts don't share a budget with
// two-factor.e2e-spec.ts, which needs its own handful of calls to those
// same rate-limited endpoints to succeed.
describe("Rate limiting (e2e)", () => {
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
    app.setGlobalPrefix("api/v1", { exclude: ["health"] });
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
});
