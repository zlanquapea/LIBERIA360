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
import { sessionCookie } from "./helpers/session-cookie";

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
      token: sessionCookie(res),
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
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
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
        .set("Cookie", userAToken)
        .expect(200);
      expect(res.body.email).toBe("usera@example.com");
      expect(res.body.passwordHash).toBeUndefined();
    });
  });

  describe("Reviews", () => {
    it("creates a review, recalculates the place rating, rejects a duplicate, and lists it", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Cookie", userAToken)
        .send({ placeId: museumPlace.id, overallRating: 4, comment: "Solid." })
        .expect(201);
      expect(create.body.user.passwordHash).toBeUndefined();

      await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Cookie", userAToken)
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

    it("rejects a review with neither placeId nor creatorId, and with both", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Cookie", userAToken)
        .send({ overallRating: 3 })
        .expect(400);

      await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Cookie", userAToken)
        .send({
          placeId: beachPlace.id,
          creatorId: "00000000-0000-0000-0000-000000000000",
          overallRating: 3,
        })
        .expect(400);
    });

    it("creates a review for a creator, recalculates the creator's rating, rejects a duplicate, and lists it", async () => {
      // A fresh user, not userA/userB — the Creators describe block below
      // relies on userB never having created a creator profile of their
      // own (see its "not a creator at all" comment), so this can't reuse
      // either of them as the profile owner.
      const creatorOwner = await registerUser(
        "review-target-owner@example.com",
        "Review Target Owner",
      );
      const creatorRes = await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Cookie", creatorOwner.token)
        .send({
          name: "Review Target Creator",
          username: "review_target_creator",
          category: "photographer",
        })
        .expect(201);
      const creatorId = creatorRes.body.id;

      const create = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Cookie", userAToken)
        .send({ creatorId, overallRating: 4, comment: "Great photos." })
        .expect(201);
      expect(create.body.user.passwordHash).toBeUndefined();
      // No booking data links a reviewer to a creator yet — always false,
      // unlike place reviews which can be verified via a confirmed
      // booking (see the "requires auth" test's sibling above).
      expect(create.body.verifiedVisit).toBe(false);

      await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Cookie", userAToken)
        .send({ creatorId, overallRating: 5 })
        .expect(409);

      const creator = await request(app.getHttpServer())
        .get("/api/v1/creators/review_target_creator")
        .expect(200);
      expect(creator.body.rating).toBe(4);
      expect(creator.body.reviewCount).toBe(1);

      const list = await request(app.getHttpServer())
        .get(`/api/v1/reviews?creatorId=${creatorId}`)
        .expect(200);
      expect(list.body.meta.total).toBe(1);

      // Same user can still review a place separately — the unique
      // constraint is per-target, not "one review ever".
      await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Cookie", userAToken)
        .send({ placeId: hotelPlace.id, overallRating: 5 })
        .expect(201);
    });
  });

  describe("Businesses", () => {
    it("claims a listing (pending review, not yet public), rejects a duplicate claim, and is only findable by its owner until approved", async () => {
      const claim = await request(app.getHttpServer())
        .post("/api/v1/businesses")
        .set("Cookie", userAToken)
        .send({
          placeId: hotelPlace.id,
          name: "Test Hotel Business",
          type: "hotel",
        })
        .expect(201);
      expect(claim.body.owner.email).toBe("usera@example.com");
      expect(claim.body.reviewStatus).toBe("submitted_for_review");
      expect(claim.body.slug).toBe("test-hotel-business");

      await request(app.getHttpServer())
        .post("/api/v1/businesses")
        .set("Cookie", userBToken)
        .send({ placeId: hotelPlace.id, name: "Dup", type: "hotel" })
        .expect(409);

      // Not yet approved — the public destination-page lookup and the
      // slug-based public profile lookup both come back empty. (A Nest
      // controller returning `null` serializes to a 200 with an *empty*
      // body, not the text "null" — see web/src/lib/api.ts's apiFetch for
      // how the frontend already accounts for this.)
      const byPlace = await request(app.getHttpServer())
        .get(`/api/v1/businesses?placeId=${hotelPlace.id}`)
        .expect(200);
      expect(byPlace.text).toBe("");
      await request(app.getHttpServer())
        .get(`/api/v1/businesses/slug/${claim.body.slug}`)
        .expect(404);

      const mine = await request(app.getHttpServer())
        .get("/api/v1/businesses/mine")
        .set("Cookie", userAToken)
        .expect(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0].reviewStatus).toBe("submitted_for_review");
    });

    it("lets the owner edit their own listing (including photos) after claiming, blocks everyone else", async () => {
      const claim = await request(app.getHttpServer())
        .post("/api/v1/businesses")
        .set("Cookie", userAToken)
        .send({
          placeId: beachPlace.id,
          name: "Test Beach Business",
          type: "tour_operator",
        })
        .expect(201);
      const businessId = claim.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/businesses/${businessId}`)
        .set("Cookie", userBToken)
        .send({ name: "Hijacked" })
        .expect(403);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/businesses/${businessId}`)
        .set("Cookie", userAToken)
        .send({
          description: "Now with real photos of the actual place.",
          images: ["/uploads/pool.jpg", "/uploads/room.jpg"],
        })
        .expect(200);
      expect(updated.body.images).toEqual([
        "/uploads/pool.jpg",
        "/uploads/room.jpg",
      ]);
      expect(updated.body.description).toBe(
        "Now with real photos of the actual place.",
      );
      // Untouched fields survive a partial update.
      expect(updated.body.name).toBe("Test Beach Business");

      await request(app.getHttpServer())
        .patch("/api/v1/businesses/00000000-0000-0000-0000-000000000000")
        .set("Cookie", userAToken)
        .send({ name: "Nope" })
        .expect(404);
    });
  });

  describe("Creators", () => {
    it("creates a profile, rejects a duplicate username, and is publicly readable", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Cookie", userAToken)
        .send({
          name: "Creator A",
          username: "creator_a",
          category: "photographer",
          countyId: montserrado.id,
          languages: ["English", "Kpelle"],
          yearsExperience: 5,
          certifications: ["Certified Drone Pilot"],
          contactEmail: "creatora@example.com",
          website: "https://creatora.example.com",
        })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Cookie", userBToken)
        .send({ name: "Dup", username: "creator_a" })
        .expect(409);

      const publicProfile = await request(app.getHttpServer())
        .get("/api/v1/creators/creator_a")
        .expect(200);
      expect(publicProfile.body.user.passwordHash).toBeUndefined();
      expect(publicProfile.body.category).toBe("photographer");
      expect(publicProfile.body.county.id).toBe(montserrado.id);
      expect(publicProfile.body.verificationStatus).toBe("unverified");
      expect(publicProfile.body.portfolioItems).toEqual([]);
      expect(publicProfile.body.offerings).toEqual([]);

      await request(app.getHttpServer())
        .get("/api/v1/creators/does-not-exist")
        .expect(404);
    });

    it("lets a creator manage their own portfolio and offerings, but not someone else's", async () => {
      // userB never created a creator profile of their own in this
      // describe block (their attempt above 409'd on userA's username) —
      // exactly the "not a creator at all" case addPortfolioItem/
      // addOffering's getOwned() should reject.
      await request(app.getHttpServer())
        .post("/api/v1/creators/me/portfolio")
        .set("Cookie", userBToken)
        .send({ type: "image", url: "https://cdn.example.com/no-profile.jpg" })
        .expect(404);

      const item = await request(app.getHttpServer())
        .post("/api/v1/creators/me/portfolio")
        .set("Cookie", userAToken)
        .send({
          type: "image",
          url: "https://cdn.example.com/shoot-1.jpg",
          caption: "Sunset at the beach",
          category: "Nature",
        })
        .expect(201);
      expect(item.body.sortOrder).toBe(0);

      const videoItem = await request(app.getHttpServer())
        .post("/api/v1/creators/me/portfolio")
        .set("Cookie", userAToken)
        .send({ type: "video", url: "https://youtu.be/abc123" })
        .expect(201);
      expect(videoItem.body.sortOrder).toBe(1);

      await request(app.getHttpServer())
        .patch(`/api/v1/creators/me/portfolio/${item.body.id}`)
        .set("Cookie", userAToken)
        .send({ caption: "Golden hour at the beach" })
        .expect(200);

      // Register a third, unrelated creator to prove ownership is
      // actually enforced, not just "any authenticated user."
      const userC = await registerUser("creatorc@example.com", "User C");
      await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Cookie", userC.token)
        .send({ name: "Creator C", username: "creator_c" })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/api/v1/creators/me/portfolio/${item.body.id}`)
        .set("Cookie", userC.token)
        .send({ caption: "Hijacked" })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/creators/me/portfolio/${item.body.id}`)
        .set("Cookie", userC.token)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/creators/me/portfolio/${videoItem.body.id}`)
        .set("Cookie", userAToken)
        .expect(200);

      const offering = await request(app.getHttpServer())
        .post("/api/v1/creators/me/offerings")
        .set("Cookie", userAToken)
        .send({
          title: "Half-day photo shoot",
          description: "Portraits around central Monrovia",
          priceFrom: 120,
          durationLabel: "4 hours",
          location: "Monrovia & surrounding areas",
        })
        .expect(201);
      expect(offering.body.priceFrom).toBe(120);

      await request(app.getHttpServer())
        .patch(`/api/v1/creators/me/offerings/${offering.body.id}`)
        .set("Cookie", userC.token)
        .send({ priceFrom: 1 })
        .expect(403);

      const withRelated = await request(app.getHttpServer())
        .get("/api/v1/creators/me")
        .set("Cookie", userAToken)
        .expect(200);
      expect(withRelated.body.portfolioItems).toHaveLength(1);
      expect(withRelated.body.portfolioItems[0].caption).toBe(
        "Golden hour at the beach",
      );
      expect(withRelated.body.offerings).toHaveLength(1);

      const publicProfile = await request(app.getHttpServer())
        .get("/api/v1/creators/creator_a")
        .expect(200);
      expect(publicProfile.body.portfolioItems).toHaveLength(1);
      expect(publicProfile.body.offerings).toHaveLength(1);

      await request(app.getHttpServer())
        .delete(`/api/v1/creators/me/offerings/${offering.body.id}`)
        .set("Cookie", userAToken)
        .expect(200);
    });

    it("filters the directory by search, category, and county", async () => {
      const byCategory = await request(app.getHttpServer())
        .get("/api/v1/creators?category=photographer")
        .expect(200);
      expect(
        byCategory.body.data.every(
          (c: { category: string }) => c.category === "photographer",
        ),
      ).toBe(true);
      expect(
        byCategory.body.data.some(
          (c: { username: string }) => c.username === "creator_a",
        ),
      ).toBe(true);

      const bySearch = await request(app.getHttpServer())
        .get("/api/v1/creators?search=creator_a")
        .expect(200);
      expect(
        bySearch.body.data.map((c: { username: string }) => c.username),
      ).toEqual(["creator_a"]);

      const byCounty = await request(app.getHttpServer())
        .get(`/api/v1/creators?countyId=${montserrado.id}`)
        .expect(200);
      expect(
        byCounty.body.data.some(
          (c: { username: string }) => c.username === "creator_a",
        ),
      ).toBe(true);
    });
  });

  describe("Events", () => {
    it("rejects a plain user with no business or creator profile", async () => {
      // userB never claimed a business or created a creator profile in the
      // blocks above (both attempts 409'd against userA's) — the plain
      // account this restriction exists for.
      await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Cookie", userBToken)
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
        .set("Cookie", userAToken)
        .send({
          name: "No Location",
          category: "concert",
          countyId: montserrado.id,
          startDate: "2026-09-01T10:00:00Z",
        })
        .expect(400);

      const concert = await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Cookie", userAToken)
        .send({
          name: "Test Concert",
          category: "concert",
          locationText: "City Hall",
          countyId: montserrado.id,
          // Must stay in the future relative to whenever this test
          // actually runs — EventsService.findAll's default public
          // listing (see events.service.ts) excludes any event whose
          // startDate has already passed, and a hardcoded date eventually
          // becomes past-dated itself, silently failing every assertion
          // below it (byCounty/byOtherCounty/byCategory all expect this
          // event to still be listed).
          startDate: new Date(Date.now() + 3_600_000).toISOString(),
        })
        .expect(201);
      // Self-service events start pending and are invisible on the public
      // listing below until an admin approves them (see Event's
      // reviewStatus doc comment) — approve directly via the DB rather
      // than plumbing an admin account through this describe block just
      // for this one assertion.
      await dataSource.query(
        "UPDATE events SET review_status = 'approved' WHERE id = $1",
        [concert.body.id],
      );

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

    it("hides a past event from the default listing, but surfaces it via includePast or an explicit dateFrom", async () => {
      const past = await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Cookie", userAToken)
        .send({
          name: "Old Festival",
          category: "festival",
          locationText: "City Hall",
          countyId: montserrado.id,
          startDate: "2020-01-01T10:00:00Z",
        })
        .expect(201);
      const pastId = past.body.id as string;
      // Same review-gate as above — approve so the assertions below are
      // actually testing the past-date filter, not the review-status one.
      await dataSource.query(
        "UPDATE events SET review_status = 'approved' WHERE id = $1",
        [pastId],
      );

      const defaultList = await request(app.getHttpServer())
        .get("/api/v1/events")
        .expect(200);
      expect(
        defaultList.body.data.some((e: { id: string }) => e.id === pastId),
      ).toBe(false);

      const withIncludePast = await request(app.getHttpServer())
        .get("/api/v1/events?includePast=true")
        .expect(200);
      expect(
        withIncludePast.body.data.some((e: { id: string }) => e.id === pastId),
      ).toBe(true);

      const withDateFrom = await request(app.getHttpServer())
        .get("/api/v1/events?dateFrom=2019-01-01")
        .expect(200);
      expect(
        withDateFrom.body.data.some((e: { id: string }) => e.id === pastId),
      ).toBe(true);
    });

    it("GET /events/mine returns only the caller's own events and requires auth", async () => {
      await request(app.getHttpServer()).get("/api/v1/events/mine").expect(401);

      const mine = await request(app.getHttpServer())
        .get("/api/v1/events/mine")
        .set("Cookie", userAToken)
        .expect(200);
      expect(mine.body.length).toBeGreaterThan(0);
      expect(
        mine.body.every(
          (e: { createdBy: { id: string } | null }) =>
            e.createdBy?.id === userAId,
        ),
      ).toBe(true);
    });

    it("lets the organizer edit and cancel their own event, blocks other users", async () => {
      const created = await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Cookie", userAToken)
        .send({
          name: "Editable Event",
          category: "concert",
          locationText: "City Hall",
          countyId: montserrado.id,
          startDate: "2026-09-05T18:00:00Z",
        })
        .expect(201);
      const eventId = created.body.id as string;

      await request(app.getHttpServer())
        .patch(`/api/v1/events/${eventId}`)
        .set("Cookie", userBToken)
        .send({ name: "Hijacked" })
        .expect(403);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/events/${eventId}`)
        .set("Cookie", userAToken)
        .send({ name: "Renamed Event" })
        .expect(200);
      expect(updated.body.name).toBe("Renamed Event");

      await request(app.getHttpServer())
        .delete(`/api/v1/events/${eventId}`)
        .set("Cookie", userBToken)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/events/${eventId}`)
        .set("Cookie", userAToken)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/events/${eventId}`)
        .expect(404);
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
    it("creates a trip with no auto-generated stops, rejects an invalid date range, and round-trips through GET", async () => {
      const trip = await request(app.getHttpServer())
        .post("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .send({
          title: "Test Trip",
          destinationPlaceId: museumPlace.id,
          visibility: "private",
          startDate: "2026-12-01",
          endDate: "2026-12-01",
          interests: ["culture-heritage", "beaches"],
          budgetBand: "moderate",
        })
        .expect(201);
      // No route is auto-filled at creation time — the traveler adds their
      // own stops afterward (POST .../stops), whichever day(s) they choose.
      expect(trip.body.stops).toEqual([]);
      expect(trip.body.durationDays).toBe(1);

      await request(app.getHttpServer())
        .post("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .send({
          title: "Test Trip",
          destinationPlaceId: museumPlace.id,
          visibility: "private",
          startDate: "2026-12-05",
          endDate: "2026-12-01", // before startDate — rejected
          interests: [],
          budgetBand: "budget",
        })
        .expect(400);

      const mine = await request(app.getHttpServer())
        .get("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .expect(200);
      expect(mine.body.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${trip.body.id}`)
        .set("Cookie", userBToken)
        .expect(404); // owner-only
    });

    it("previews a trip with no auth at all, saving nothing, and still enforces validation", async () => {
      const before = await request(app.getHttpServer())
        .get("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .expect(200);

      const preview = await request(app.getHttpServer())
        .post("/api/v1/itineraries/preview")
        .send({
          startDate: "2026-12-01",
          endDate: "2026-12-01",
          interests: ["culture-heritage", "beaches"],
          budgetBand: "moderate",
        })
        .expect(201);
      expect(preview.body.id).toBeUndefined(); // nothing was persisted
      expect(preview.body.stops).toEqual([]); // no route is auto-generated

      await request(app.getHttpServer())
        .post("/api/v1/itineraries/preview")
        .send({
          startDate: "2026-12-05",
          endDate: "2026-12-01", // before startDate — rejected
          interests: [],
          budgetBand: "budget",
        })
        .expect(400);

      await request(app.getHttpServer())
        .post("/api/v1/itineraries/preview")
        .send({
          startDate: "2026-12-01",
          endDate: "2027-01-01", // more than 14 days — rejected
          interests: ["culture-heritage", "beaches"],
          budgetBand: "moderate",
        })
        .expect(400);

      // Not tied to userAToken at all (no Authorization header sent above)
      // — this confirms the preview call didn't sneak a save in under
      // anyone's account, not just this one user's.
      const after = await request(app.getHttpServer())
        .get("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .expect(200);
      expect(after.body.length).toBe(before.body.length);
    });
  });

  describe("Collaborative trip planning", () => {
    let tripId: string;
    let strangerToken: string;

    beforeAll(async () => {
      const trip = await request(app.getHttpServer())
        .post("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .send({
          title: "Test Trip",
          destinationPlaceId: museumPlace.id,
          visibility: "private",
          startDate: "2026-12-01",
          endDate: "2026-12-01",
          interests: ["culture-heritage", "beaches"],
          budgetBand: "moderate",
        })
        .expect(201);
      tripId = trip.body.id;
      const stranger = await registerUser(
        "tripStranger@example.com",
        "Stranger",
      );
      strangerToken = stranger.token;
    });

    it("404s inviting/viewing/editing for anyone but the owner, before any invite exists", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/invitations`)
        .set("Cookie", strangerToken)
        .send({ invitees: [{ email: "userB@example.com" }] })
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .expect(404);
    });

    it("creates a pending invitation for a bare email with no account yet — no 404, unlike the old immediate-add-only flow", async () => {
      const invite = await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/invitations`)
        .set("Cookie", userAToken)
        .send({ invitees: [{ email: "nobody@example.com" }] })
        .expect(201);
      const created = invite.body.find(
        (i: { email: string }) => i.email === "nobody@example.com",
      );
      expect(created.status).toBe("pending");
      expect(created.invitee).toBeNull();

      // Cancel it — this test's invitee doesn't participate in the rest
      // of the flow below.
      await request(app.getHttpServer())
        .delete(`/api/v1/itineraries/${tripId}/invitations/${created.id}`)
        .set("Cookie", userAToken)
        .expect(200);
    });

    it("lets the owner invite an existing user by id, who accepts and can then view and edit the trip", async () => {
      const invite = await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/invitations`)
        .set("Cookie", userAToken)
        .send({ invitees: [{ userId: userBId }] })
        .expect(201);
      const pending = invite.body.find(
        (i: { email: string }) => i.email === "userb@example.com",
      );
      expect(pending.status).toBe("pending");
      expect(pending.invitee.id).toBe(userBId);
      expect(pending.invitee.passwordHash).toBeUndefined();

      // Re-inviting a still-pending person resends rather than erroring.
      await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/invitations`)
        .set("Cookie", userAToken)
        .send({ invitees: [{ userId: userBId }] })
        .expect(201);

      // Not a collaborator yet — invited, not accepted.
      await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .expect(404);

      // The invitee finds it in their own inbox without the emailed link...
      const mine = await request(app.getHttpServer())
        .get("/api/v1/invitations/mine")
        .set("Cookie", userBToken)
        .expect(200);
      const mineEntry = mine.body.find(
        (i: { tripId: string }) => i.tripId === tripId,
      );
      expect(mineEntry).toBeDefined();

      // ...and accepting there makes them a real collaborator.
      await request(app.getHttpServer())
        .post(`/api/v1/invitations/${pending.id}/accept`)
        .set("Cookie", userBToken)
        .expect(201);

      // Accepting again 409s (already resolved).
      await request(app.getHttpServer())
        .post(`/api/v1/invitations/${pending.id}/accept`)
        .set("Cookie", userBToken)
        .expect(409);

      // Inviting an already-confirmed collaborator again is a conflict.
      await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/invitations`)
        .set("Cookie", userAToken)
        .send({ invitees: [{ userId: userBId }] })
        .expect(409);

      const asCollaborator = await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .expect(200);
      expect(asCollaborator.body.collaborators).toHaveLength(1);

      // A collaborator can't invite further collaborators onto the trip.
      await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/invitations`)
        .set("Cookie", userBToken)
        .send({ invitees: [{ email: "tripStranger@example.com" }] })
        .expect(403);

      // A collaborator can add, annotate, and remove a stop.
      const added = await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/stops`)
        .set("Cookie", userBToken)
        .send({ placeId: hotelPlace.id, day: 1, notes: "Check in first" })
        .expect(201);
      expect(
        added.body.stops.some(
          (s: { place: { id: string } }) => s.place.id === hotelPlace.id,
        ),
      ).toBe(true);

      // Adding the same place twice is rejected.
      await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/stops`)
        .set("Cookie", userAToken)
        .send({ placeId: hotelPlace.id, day: 1 })
        .expect(409);

      const annotated = await request(app.getHttpServer())
        .patch(`/api/v1/itineraries/${tripId}/stops/${hotelPlace.id}`)
        .set("Cookie", userAToken)
        .send({ notes: "Confirmed 2pm check-in" })
        .expect(200);
      expect(
        annotated.body.stops.find(
          (s: { place: { id: string } }) => s.place.id === hotelPlace.id,
        ).notes,
      ).toBe("Confirmed 2pm check-in");

      const removed = await request(app.getHttpServer())
        .delete(`/api/v1/itineraries/${tripId}/stops/${hotelPlace.id}`)
        .set("Cookie", userBToken)
        .expect(200);
      expect(
        removed.body.stops.some(
          (s: { place: { id: string } }) => s.place.id === hotelPlace.id,
        ),
      ).toBe(false);

      // Stop mutations stay off-limits to a non-member.
      await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/stops`)
        .set("Cookie", strangerToken)
        .send({ placeId: hotelPlace.id, day: 1 })
        .expect(404);

      // "Shared with me" surfaces it for the collaborator, not the stranger.
      const shared = await request(app.getHttpServer())
        .get("/api/v1/itineraries/shared-with-me")
        .set("Cookie", userBToken)
        .expect(200);
      expect(shared.body.some((t: { id: string }) => t.id === tripId)).toBe(
        true,
      );

      // Collaborator leaves the trip themself; owner can no longer be
      // blocked by them, and userB loses view access again.
      await request(app.getHttpServer())
        .delete(`/api/v1/itineraries/${tripId}/collaborators/${userBId}`)
        .set("Cookie", userBToken)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .expect(404);
    });
  });

  describe("Trip rename and delete", () => {
    let tripId: string;

    beforeAll(async () => {
      const trip = await request(app.getHttpServer())
        .post("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .send({
          title: "Test Trip",
          destinationPlaceId: museumPlace.id,
          visibility: "private",
          startDate: "2026-12-01",
          endDate: "2026-12-01",
          interests: ["culture-heritage"],
          budgetBand: "moderate",
        })
        .expect(201);
      tripId = trip.body.id;
    });

    it("404s a stranger renaming or deleting", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .send({ title: "Hijacked" })
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .expect(404);
    });

    it("lets the owner rename the trip", async () => {
      const renamed = await request(app.getHttpServer())
        .patch(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userAToken)
        .send({ title: "Mom's 60th birthday trip" })
        .expect(200);
      expect(renamed.body.title).toBe("Mom's 60th birthday trip");
    });

    it("lets a collaborator rename the trip too, but not delete it", async () => {
      const invite = await request(app.getHttpServer())
        .post(`/api/v1/itineraries/${tripId}/invitations`)
        .set("Cookie", userAToken)
        .send({ invitees: [{ userId: userBId }] })
        .expect(201);
      const pending = invite.body.find(
        (i: { email: string }) => i.email === "userb@example.com",
      );
      await request(app.getHttpServer())
        .post(`/api/v1/invitations/${pending.id}/accept`)
        .set("Cookie", userBToken)
        .expect(201);

      const renamed = await request(app.getHttpServer())
        .patch(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .send({ title: "Renamed by collaborator" })
        .expect(200);
      expect(renamed.body.title).toBe("Renamed by collaborator");

      await request(app.getHttpServer())
        .delete(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .expect(403);
    });

    it("deleting the trip cascades — collaborators and invitations lose access, and it vanishes from every list", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userAToken)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userAToken)
        .expect(404);
      await request(app.getHttpServer())
        .get(`/api/v1/itineraries/${tripId}`)
        .set("Cookie", userBToken)
        .expect(404);

      const shared = await request(app.getHttpServer())
        .get("/api/v1/itineraries/shared-with-me")
        .set("Cookie", userBToken)
        .expect(200);
      expect(shared.body.some((t: { id: string }) => t.id === tripId)).toBe(
        false,
      );

      const mine = await request(app.getHttpServer())
        .get("/api/v1/itineraries")
        .set("Cookie", userAToken)
        .expect(200);
      expect(mine.body.some((t: { id: string }) => t.id === tripId)).toBe(
        false,
      );
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
        .set("Cookie", userAToken)
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
