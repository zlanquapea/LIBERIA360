import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { County } from "../src/counties/entities/county.entity";
import { Category } from "../src/categories/entities/category.entity";
import { Place } from "../src/places/entities/place.entity";
import { Activity } from "../src/activities/entities/activity.entity";
import {
  PlaceType,
  RecommendedVisitLength,
  VerificationStatus,
} from "../src/places/entities/place.enums";

describe("Places/Counties/Categories catalog (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let montserrado: County;
  let beaches: Category;
  let culture: Category;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror src/main.ts so the e2e app behaves like production.
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

    // Clean slate, FK-safe order.
    await dataSource.query(
      "TRUNCATE TABLE activities, places, categories, counties RESTART IDENTITY CASCADE",
    );

    const countyRepo = dataSource.getRepository(County);
    const categoryRepo = dataSource.getRepository(Category);
    const placeRepo = dataSource.getRepository(Place);
    const activityRepo = dataSource.getRepository(Activity);

    montserrado = await countyRepo.save(
      countyRepo.create({
        name: "Montserrado",
        slug: "montserrado",
        rolloutStage: 1,
      }),
    );
    await countyRepo.save(
      countyRepo.create({ name: "Bong", slug: "bong", rolloutStage: 2 }),
    );

    beaches = await categoryRepo.save(
      categoryRepo.create({
        name: "Beaches",
        slug: "beaches",
        icon: "🏖️",
        description: "Beach spots",
      }),
    );
    culture = await categoryRepo.save(
      categoryRepo.create({
        name: "Culture & Heritage",
        slug: "culture-heritage",
        icon: "🏛️",
        description: "Historic sites",
      }),
    );

    const beachPlace = await placeRepo.save(
      placeRepo.create({
        name: "Test Beach",
        slug: "test-beach",
        description: "A beach used for e2e testing.",
        type: PlaceType.NATURE_SITE,
        category: beaches,
        tags: ["swimming", "surfing"],
        county: montserrado,
        city: "Monrovia",
        latitude: 6.3,
        longitude: -10.8,
        distanceFromMonroviaKm: 5,
        recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
        rating: 4.5,
        featured: true,
        verificationStatus: VerificationStatus.VERIFIED,
      }),
    );
    await activityRepo.save(
      activityRepo.create({
        placeId: beachPlace.id,
        name: "Surf lesson",
        description: "Beginner surf lesson",
        duration: "1 hour",
        guideRequired: true,
      }),
    );

    await placeRepo.save(
      placeRepo.create({
        name: "Test Museum",
        slug: "test-museum",
        description: "A museum used for e2e testing.",
        type: PlaceType.ATTRACTION,
        category: culture,
        tags: ["history"],
        county: montserrado,
        city: "Monrovia",
        latitude: 6.31,
        longitude: -10.79,
        distanceFromMonroviaKm: 1,
        recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
        rating: 3.8,
        featured: false,
        verificationStatus: VerificationStatus.UNVERIFIED,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("reports ok without the /api/v1 prefix", async () => {
      const res = await request(app.getHttpServer()).get("/health").expect(200);
      expect(res.body.status).toBe("ok");
    });
  });

  describe("GET /api/v1/categories", () => {
    it("lists categories with place counts", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/categories")
        .expect(200);
      const beachCategory = res.body.find((c: any) => c.slug === "beaches");
      expect(beachCategory).toBeDefined();
      expect(beachCategory.placeCount).toBe(1);
    });
  });

  describe("GET /api/v1/counties", () => {
    it("lists all seeded counties with place counts, ordered by rollout stage", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/counties")
        .expect(200);
      expect(res.body.map((c: any) => c.slug)).toEqual(["montserrado", "bong"]);
      expect(res.body[0].placeCount).toBe(2);
      expect(res.body[1].placeCount).toBe(0);
    });
  });

  describe("GET /api/v1/counties/:id/places", () => {
    it("returns places scoped to the county", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/counties/bong/places")
        .expect(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it("404s for an unknown county", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/counties/not-a-real-county/places")
        .expect(404);
    });
  });

  describe("GET /api/v1/places", () => {
    it("lists places with pagination metadata", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places")
        .expect(200);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });

    it("filters by category slug", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?category=beaches")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual(["test-beach"]);
    });

    it("filters by tag", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?tag=surfing")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual(["test-beach"]);
    });

    it("full-text searches name and description", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=museum")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual(["test-museum"]);
    });

    it("sorts by rating descending", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?sort=rating")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual([
        "test-beach",
        "test-museum",
      ]);
    });

    it("paginates with limit/page", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?limit=1&page=2&sort=name")
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual({
        total: 2,
        page: 2,
        limit: 1,
        totalPages: 2,
      });
    });

    it("rejects an out-of-range limit", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/places?limit=999")
        .expect(400);
    });
  });

  describe("GET /api/v1/places/:slug", () => {
    it("returns the full destination profile including activities", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places/test-beach")
        .expect(200);
      expect(res.body.name).toBe("Test Beach");
      expect(res.body.category.slug).toBe("beaches");
      expect(res.body.county.slug).toBe("montserrado");
      expect(res.body.activities).toHaveLength(1);
      expect(res.body.activities[0].name).toBe("Surf lesson");
    });

    it("404s for an unknown slug", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/places/does-not-exist")
        .expect(404);
    });
  });
});
