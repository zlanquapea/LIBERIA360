import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { County } from "../src/counties/entities/county.entity";
import { Category } from "../src/categories/entities/category.entity";
import { Place } from "../src/places/entities/place.entity";
import {
  PlaceType,
  RecommendedVisitLength,
  VerificationStatus,
} from "../src/places/entities/place.enums";

// This file owns a full reset of every Phase 1 + Phase 2 table in its own
// beforeAll and is fully self-contained (doesn't assume any other spec file
// ran first). test/jest-e2e.json sets maxWorkers: 1 so e2e spec files never
// run concurrently against the shared test database — required here since
// TRUNCATE ... CASCADE on `users`/`places` reaches every Phase 2 table that
// references them (reviews, businesses, creators, events, itineraries,
// push_subscriptions).
describe("Phase 2 (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let montserrado: County;
  let cultureCategory: Category;
  let beachesCategory: Category;

  let museumPlace: Place; // central Monrovia, cheap — culture-heritage
  let beachPlace: Place; // central Monrovia, free — beaches
  let hotelPlace: Place; // central Monrovia — for business claim

  let userAToken: string;
  let userAId: string;
  let userBToken: string;
  let userBId: string;

  async function registerUser(email: string, name: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name, email, password: "password123" })
      .expect(201);
    return {
      token: res.body.accessToken as string,
      id: res.body.user.id as string,
    };
  }

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

    await dataSource.query(
      "TRUNCATE TABLE push_subscriptions, itineraries, events, creators, businesses, reviews, activities, places, categories, counties, users RESTART IDENTITY CASCADE",
    );

    const countyRepo = dataSource.getRepository(County);
    const categoryRepo = dataSource.getRepository(Category);
    const placeRepo = dataSource.getRepository(Place);

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

    cultureCategory = await categoryRepo.save(
      categoryRepo.create({
        name: "Culture & Heritage",
        slug: "culture-heritage",
        icon: "🏛️",
      }),
    );
    beachesCategory = await categoryRepo.save(
      categoryRepo.create({ name: "Beaches", slug: "beaches", icon: "🏖️" }),
    );

    museumPlace = await placeRepo.save(
      placeRepo.create({
        name: "Test Museum",
        slug: "test-museum",
        description: "A museum for e2e testing.",
        type: PlaceType.ATTRACTION,
        category: cultureCategory,
        tags: [],
        county: montserrado,
        city: "Monrovia",
        latitude: 6.3009,
        longitude: -10.7975,
        distanceFromMonroviaKm: 1,
        recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
        estimatedCostEntry: 5,
        verificationStatus: VerificationStatus.UNVERIFIED,
      }),
    );
    beachPlace = await placeRepo.save(
      placeRepo.create({
        name: "Test Beach",
        slug: "test-beach",
        description: "A beach for e2e testing.",
        type: PlaceType.NATURE_SITE,
        category: beachesCategory,
        tags: [],
        county: montserrado,
        city: "Monrovia",
        latitude: 6.31,
        longitude: -10.805,
        distanceFromMonroviaKm: 2,
        recommendedVisitLength: RecommendedVisitLength.DAY_TRIP,
        estimatedCostEntry: 0,
        verificationStatus: VerificationStatus.UNVERIFIED,
      }),
    );
    hotelPlace = await placeRepo.save(
      placeRepo.create({
        name: "Test Hotel",
        slug: "test-hotel",
        description: "A hotel for e2e testing.",
        type: PlaceType.HOTEL,
        category: cultureCategory,
        tags: [],
        county: montserrado,
        city: "Monrovia",
        latitude: 6.29,
        longitude: -10.79,
        verificationStatus: VerificationStatus.UNVERIFIED,
      }),
    );

    const userA = await registerUser("userA@example.com", "User A");
    userAToken = userA.token;
    userAId = userA.id;
    const userB = await registerUser("userB@example.com", "User B");
    userBToken = userB.token;
    userBId = userB.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Auth", () => {
    it("rejects a duplicate email on register", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          name: "Dup",
          email: "userA@example.com",
          password: "password123",
        })
        .expect(409);
    });

    it("logs in with correct credentials and rejects wrong ones", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "userA@example.com", password: "password123" })
        .expect(200);
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({ email: "userA@example.com", password: "wrong" })
        .expect(401);
    });

    it("GET /auth/me requires a token and returns the caller without a passwordHash", async () => {
      await request(app.getHttpServer()).get("/api/v1/auth/me").expect(401);
      const res = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${userAToken}`)
        .expect(200);
      expect(res.body.email).toBe("usera@example.com");
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe("Reviews", () => {
    it("creates a review, recalculates the place rating, rejects a duplicate, and lists it", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({ placeId: museumPlace.id, overallRating: 4, comment: "Solid." })
        .expect(201);
      expect(create.body.user.passwordHash).toBeUndefined();

      await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({ placeId: museumPlace.id, overallRating: 5 })
        .expect(409);

      const place = await request(app.getHttpServer())
        .get(`/api/v1/places/${museumPlace.slug}`)
        .expect(200);
      expect(place.body.rating).toBe(4);
      expect(place.body.reviewCount).toBe(1);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/reviews?placeId=${museumPlace.id}`)
        .expect(200);
      expect(list.body.meta.total).toBe(1);
    });

    it("requires auth to create a review", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .send({ placeId: beachPlace.id, overallRating: 3 })
        .expect(401);
    });
  });

  describe("Businesses", () => {
    it("claims a listing, rejects a duplicate claim, and is findable by place", async () => {
      const claim = await request(app.getHttpServer())
        .post("/api/v1/businesses")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          placeId: hotelPlace.id,
          name: "Test Hotel Business",
          type: "hotel",
        })
        .expect(201);
      expect(claim.body.owner.email).toBe("usera@example.com");

      await request(app.getHttpServer())
        .post("/api/v1/businesses")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({ placeId: hotelPlace.id, name: "Dup", type: "hotel" })
        .expect(409);

      const byPlace = await request(app.getHttpServer())
        .get(`/api/v1/businesses?placeId=${hotelPlace.id}`)
        .expect(200);
      expect(byPlace.body.name).toBe("Test Hotel Business");

      const mine = await request(app.getHttpServer())
        .get("/api/v1/businesses/mine")
        .set("Authorization", `Bearer ${userAToken}`)
        .expect(200);
      expect(mine.body).toHaveLength(1);
    });
  });

  describe("Creators", () => {
    it("creates a profile, rejects a duplicate username, and is publicly readable", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({ name: "Creator A", username: "creator_a" })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({ name: "Dup", username: "creator_a" })
        .expect(409);

      const publicProfile = await request(app.getHttpServer())
        .get("/api/v1/creators/creator_a")
        .expect(200);
      expect(publicProfile.body.user.passwordHash).toBeUndefined();

      await request(app.getHttpServer())
        .get("/api/v1/creators/does-not-exist")
        .expect(404);
    });
  });

  describe("Events", () => {
    it("rejects a plain user with no business or creator profile", async () => {
      // userB never claimed a business or created a creator profile in the
      // blocks above (both attempts 409'd against userA's) — the plain
      // account this restriction exists for.
      await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${userBToken}`)
        .send({
          name: "Should Be Blocked",
          category: "concert",
          locationText: "City Hall",
          countyId: montserrado.id,
          startDate: "2026-09-01T18:00:00Z",
        })
        .expect(403);
    });

    it("requires a location, rejects a bad date range, and filters by county/category", async () => {
      // userA claimed a business and a creator profile earlier in this
      // file, so it's eligible to post events under the same restriction.
      await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "No Location",
          category: "concert",
          countyId: montserrado.id,
          startDate: "2026-09-01T10:00:00Z",
        })
        .expect(400);

      await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          name: "Test Concert",
          category: "concert",
          locationText: "City Hall",
          countyId: montserrado.id,
          startDate: "2026-09-01T18:00:00Z",
        })
        .expect(201);

      const byCounty = await request(app.getHttpServer())
        .get("/api/v1/events?county=montserrado")
        .expect(200);
      expect(byCounty.body.meta.total).toBe(1);

      const byOtherCounty = await request(app.getHttpServer())
        .get("/api/v1/events?county=bong")
        .expect(200);
      expect(byOtherCounty.body.meta.total).toBe(0);

      const byCategory = await request(app.getHttpServer())
        .get("/api/v1/events?category=sports")
        .expect(200);
      expect(byCategory.body.meta.total).toBe(0);
    });
  });

  describe("Near Me radius search", () => {
    it("filters places within a radius and requires lat/lng/radiusKm together", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/places?lat=6.30&lng=-10.80&radiusKm=5")
        .expect(200);
      const names = res.body.data.map((p: { name: string }) => p.name);
      expect(names).toEqual(
        expect.arrayContaining(["Test Museum", "Test Beach", "Test Hotel"]),
      );
      expect(res.body.data[0].distanceKm).not.toBeNull();

      await request(app.getHttpServer())
        .get("/api/v1/places?lat=6.30")
        .expect(400);
    });
  });

  describe("Itineraries", () => {
    it("generates a trip, rejects when nothing matches, and round-trips through GET", async () => {
      const trip = await request(app.getHttpServer())
        .post("/api/v1/itineraries")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          durationDays: 1,
          interests: ["culture-heritage", "beaches"],
          budgetBand: "moderate",
        })
        .expect(201);
      expect(trip.body.stops.length).toBeGreaterThan(0);
      expect(trip.body.stops[0].place.name).toBeDefined();

      await request(app.getHttpServer())
        .post("/api/v1/itineraries")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          durationDays: 1,
          interests: ["does-not-exist"],
          budgetBand: "budget",
        })
        .expect(400);

      const mine = await request(app.getHttpServer())
        .get("/api/v1/itineraries")
        .set("Authorization", `Bearer ${userAToken}`)
        .expect(200);
      expect(mine.body.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${trip.body.id}`)
        .set("Authorization", `Bearer ${userBToken}`)
        .expect(404); // owner-only
    });

    it("Weekend Explorer generates from an explicit starting point, and 404s when nothing is reachable", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/itineraries/weekend")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          startLat: 6.3,
          startLng: -10.8,
          maxTravelTimeMinutes: 15,
          interests: [],
          budgetBand: "premium",
        })
        .expect(201);

      // Far from every fixture place — nothing falls within a 15-minute
      // (~8.75km) radius, so this should 404 rather than return an empty trip.
      await request(app.getHttpServer())
        .post("/api/v1/itineraries/weekend")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          startLat: 7.5,
          startLng: -11.5,
          maxTravelTimeMinutes: 15,
          interests: [],
          budgetBand: "premium",
        })
        .expect(404);
    });
  });

  describe("Push", () => {
    it("exposes the VAPID public key and requires auth to subscribe", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/push/vapid-public-key")
        .expect(200);
      await request(app.getHttpServer())
        .post("/api/v1/push/subscribe")
        .send({
          endpoint: "https://example.com/x",
          keys: { p256dh: "a", auth: "b" },
        })
        .expect(401);
      await request(app.getHttpServer())
        .post("/api/v1/push/subscribe")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          endpoint: "https://example.com/x",
          keys: { p256dh: "a", auth: "b" },
        })
        .expect(204);
    });
  });

  // Keeps the "unused variable" linter happy while documenting that these
  // ids are deliberately part of the fixture surface other tests rely on.
  it("fixture sanity check", () => {
    expect([userAId, userBId]).toHaveLength(2);
  });
});
