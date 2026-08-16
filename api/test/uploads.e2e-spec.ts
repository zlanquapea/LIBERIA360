import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { existsSync, rmSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { localUploadsDir } from "../src/uploads/local-uploads-dir";

// Real HTTP-level coverage of POST /uploads/image — separate from the unit
// tests in src/uploads (which mock the storage layer and image processing
// individually) since the thing actually worth proving end to end is that
// a real multipart upload survives the full pipeline: multer -> sharp
// re-encoding -> LocalStorageProvider -> served back at the returned URL.
// STORAGE_DRIVER isn't set for the test env (see test/setup-env.ts), so
// this exercises the local-disk path — the same default a fresh checkout
// runs under.
describe("Uploads (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  const writtenFiles: string[] = [];

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

    const register = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        name: "Upload User",
        email: "upload-user@example.com",
        password: "password123",
      })
      .expect(201);
    token = register.body.accessToken;
  });

  afterAll(async () => {
    // Local-disk storage really writes to api/uploads/ — clean up what
    // this file created so repeated runs don't accumulate test fixtures
    // in a folder real dev uploads also live in.
    for (const filePath of writtenFiles) {
      try {
        rmSync(filePath);
      } catch {
        // already gone / never created — fine either way
      }
    }
    await app.close();
  });

  it("requires auth", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/uploads/image")
      .expect(401);
  });

  it("rejects a disallowed file type", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/uploads/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("not an image"), {
        filename: "note.txt",
        contentType: "text/plain",
      })
      .expect(400);
  });

  it("rejects a file whose bytes aren't a real image even if the MIME type header claims otherwise", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/uploads/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("definitely-not-a-jpeg"), {
        filename: "fake.jpg",
        contentType: "image/jpeg",
      })
      .expect(400);
  });

  it("accepts a real image, strips EXIF, resizes it, and serves it back at the returned URL", async () => {
    const original = await sharp({
      create: {
        width: 3000,
        height: 2000,
        channels: 3,
        background: { r: 10, g: 100, b: 200 },
      },
    })
      .withExif({ IFD0: { Make: "TestCam" } })
      .jpeg()
      .toBuffer();

    const res = await request(app.getHttpServer())
      .post("/api/v1/uploads/image")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", original, {
        filename: "room.jpg",
        contentType: "image/jpeg",
      })
      .expect(201);

    expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/);

    const filePath = join(
      localUploadsDir(),
      res.body.url.replace("/uploads/", ""),
    );
    writtenFiles.push(filePath);
    expect(existsSync(filePath)).toBe(true);

    const metadata = await sharp(filePath).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(2000); // downscaled from the 3000px original
    expect(metadata.exif).toBeUndefined();
  });
});
