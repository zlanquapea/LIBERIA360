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
import { OpeningPeriod } from "../src/places/opening-hours";

const ALL_DAYS_ALWAYS_OPEN: OpeningPeriod[] = (
  [0, 1, 2, 3, 4, 5, 6] as const
).map((dayOfWeek) => ({ dayOfWeek, opens: "00:00", closes: "24:00" }));

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
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
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

    // Deliberately no literal "beach" anywhere in the name/description —
    // this is what a full-text-only search misses (the exact live-site
    // gap the review readout flagged: "beach" returning zero results
    // despite Beaches being a supported category), and what the
    // category-alias matching in findMatchingCategory exists to catch.
    await placeRepo.save(
      placeRepo.create({
        name: "Robertsport",
        slug: "robertsport",
        description:
          "A quiet coastal town in Grand Cape Mount, popular with surfers.",
        type: PlaceType.NATURE_SITE,
        category: beaches,
        tags: [],
        county: montserrado,
        city: "Robertsport",
        latitude: 6.75,
        longitude: -11.37,
        distanceFromMonroviaKm: 120,
        recommendedVisitLength: RecommendedVisitLength.OVERNIGHT,
        rating: 4.2,
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

  describe("GET /health/ready", () => {
    it("reports ok without the /api/v1 prefix, since it can reach the DB", async () => {
      const res = await request(app.getHttpServer())
        .get("/health/ready")
        .expect(200);
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
      expect(beachCategory.placeCount).toBe(2);
    });
  });

  describe("GET /api/v1/counties", () => {
    it("lists all seeded counties with place counts, ordered by rollout stage", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/counties")
        .expect(200);
      expect(res.body.map((c: any) => c.slug)).toEqual(["montserrado", "bong"]);
      expect(res.body[0].placeCount).toBe(3);
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
      expect(res.body.meta.total).toBe(3);
      expect(res.body.data).toHaveLength(3);
    });

    it("filters by category slug", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?category=beaches")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual([
        "test-beach",
        "robertsport",
      ]);
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

    it("stems the query — a plural matches the singular in the catalog", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=museums")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual(["test-museum"]);
    });

    it("AND-matches a multi-word query (websearch_to_tsquery default)", async () => {
      // Both places' seeded descriptions end in "used for e2e testing.",
      // so only the beach-specific word narrows it to one result.
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=beach%20testing")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual(["test-beach"]);
    });

    it("returns no results for a term nowhere in the catalog, not an error", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=nonexistentxyz")
        .expect(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    // Product review readout (Aug 22, 2026): "beach" returned zero results
    // despite Beaches being a supported category. Robertsport is seeded
    // deliberately without the literal word "beach" anywhere in its
    // name/description — a full-text-only search would miss it entirely.
    it("falls back to category matching for a single-word query with no direct full-text hit", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=beach")
        .expect(200);
      // test-beach matches on text (and ranks first); robertsport only
      // through the Beaches category match.
      expect(res.body.data.map((p: any) => p.slug)).toEqual([
        "test-beach",
        "robertsport",
      ]);
    });

    it("also matches a category via a known alias word", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=surf")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toContain("robertsport");
    });

    it("does not apply category matching to a multi-word query", async () => {
      // "beach vacation" as a whole phrase shouldn't pull in every place
      // in Beaches — only a genuine full-text hit should.
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=beach%20vacation")
        .expect(200);
      expect(res.body.data).toEqual([]);
    });

    it("still applies an explicit sort alongside a text search", async () => {
      // Both fixtures' descriptions independently match "testing" — this
      // is really just checking sort=rating doesn't get silently
      // overridden by the query-present relevance-ranking default.
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=testing&sort=rating")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual([
        "test-beach",
        "test-museum",
      ]);
    });

    it("sorts by rating descending", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?sort=rating")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual([
        "test-beach",
        "robertsport",
        "test-museum",
      ]);
    });

    it("paginates with limit/page", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?limit=1&page=2&sort=name")
        .expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toEqual({
        total: 3,
        page: 2,
        limit: 1,
        totalPages: 3,
      });
    });

    it("rejects an out-of-range limit", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/places?limit=999")
        .expect(400);
    });
  });

  // Isolated from the shared fixture set above (its own places, inserted
  // and removed around just this block) rather than added to the main
  // beforeAll — a "24/7, always open" and a "never open" place would
  // otherwise ripple into practically every count/order assertion above,
  // same lesson as the Robertsport fixture from the search-recovery work.
  // Real time (not a fixed clock) is used deliberately: 24/7-open and
  // never-open are both true at any possible "now", so this needs no
  // mocking to be deterministic.
  describe("GET /api/v1/places?openNow=", () => {
    let alwaysOpenId: string;
    let neverOpenId: string;
    let unknownHoursId: string;

    beforeAll(async () => {
      const placeRepo = dataSource.getRepository(Place);
      const alwaysOpen = await placeRepo.save(
        placeRepo.create({
          name: "Always Open Shop",
          slug: "always-open-shop",
          description: "Open around the clock, every day of the week.",
          type: PlaceType.ATTRACTION,
          category: culture,
          county: montserrado,
          city: "Monrovia",
          latitude: 6.3,
          longitude: -10.8,
          openingHours: "24/7",
          structuredHours: ALL_DAYS_ALWAYS_OPEN,
          verificationStatus: VerificationStatus.UNVERIFIED,
        }),
      );
      alwaysOpenId = alwaysOpen.id;

      const neverOpen = await placeRepo.save(
        placeRepo.create({
          name: "Never Open Shop",
          slug: "never-open-shop",
          description: "Structured hours parsed but the list is empty.",
          type: PlaceType.ATTRACTION,
          category: culture,
          county: montserrado,
          city: "Monrovia",
          latitude: 6.3,
          longitude: -10.8,
          structuredHours: [],
          verificationStatus: VerificationStatus.UNVERIFIED,
        }),
      );
      neverOpenId = neverOpen.id;

      const unknownHours = await placeRepo.save(
        placeRepo.create({
          name: "Unknown Hours Shop",
          slug: "unknown-hours-shop",
          description: "No opening hours on file at all.",
          type: PlaceType.ATTRACTION,
          category: culture,
          county: montserrado,
          city: "Monrovia",
          latitude: 6.3,
          longitude: -10.8,
          verificationStatus: VerificationStatus.UNVERIFIED,
        }),
      );
      unknownHoursId = unknownHours.id;
    });

    afterAll(async () => {
      const placeRepo = dataSource.getRepository(Place);
      await placeRepo.delete([alwaysOpenId, neverOpenId, unknownHoursId]);
    });

    it("includes a place with 24/7 structured hours no matter the actual time", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?openNow=true&q=shop")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug)).toEqual([
        "always-open-shop",
      ]);
    });

    it("excludes a place with empty structured hours and one with no hours at all", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?openNow=true&q=shop")
        .expect(200);
      const slugs = res.body.data.map((p: any) => p.slug);
      expect(slugs).not.toContain("never-open-shop");
      expect(slugs).not.toContain("unknown-hours-shop");
    });

    it("returns every 'shop' place when openNow isn't set", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?q=shop")
        .expect(200);
      expect(res.body.data.map((p: any) => p.slug).sort()).toEqual([
        "always-open-shop",
        "never-open-shop",
        "unknown-hours-shop",
      ]);
    });

    it("returns an empty page rather than an error when nothing matches openNow", async () => {
      // Multi-word, so this doesn't trigger the single-word category-alias
      // match (see "does not apply category matching to a multi-word
      // query" above) — a plain AND full-text match on all three words,
      // which only "Never Open Shop" itself satisfies.
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?openNow=true&q=never%20open%20shop")
        .expect(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toEqual({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
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
