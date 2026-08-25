import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { County } from "../src/counties/entities/county.entity";
import { Category } from "../src/categories/entities/category.entity";
import { Place } from "../src/places/entities/place.entity";
import { User } from "../src/users/entities/user.entity";
import {
  PlaceType,
  RecommendedVisitLength,
  VerificationStatus,
} from "../src/places/entities/place.enums";

// Self-contained (own full reset in beforeAll), same rationale as
// phase2.e2e-spec.ts: test/jest-e2e.json's maxWorkers: 1 serializes e2e
// spec files against the shared test DB, since TRUNCATE ... CASCADE here
// reaches every Phase 1/2/3 table.
describe("Phase 3 (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let montserrado: County;
  let cultureCategory: Category;

  let hotelPlace: Place; // claimed by ownerToken below — used for bookings/analytics
  let unclaimedPlace: Place; // for admin business creation + sponsored placements

  let guestToken: string;
  let ownerToken: string;
  let adminToken: string;
  let strangerToken: string;
  let superAdminToken: string;
  let superAdminId: string;

  let hotelBusinessId: string;

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
    app.setGlobalPrefix("api/v1", { exclude: ["health", "health/ready"] });
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    await dataSource.runMigrations();

    await dataSource.query(
      "TRUNCATE TABLE bookings, sponsored_placements, analytics_events, push_subscriptions, itineraries, events, creators, businesses, reviews, activities, places, categories, counties, users RESTART IDENTITY CASCADE",
    );

    const countyRepo = dataSource.getRepository(County);
    const categoryRepo = dataSource.getRepository(Category);
    const placeRepo = dataSource.getRepository(Place);
    const userRepo = dataSource.getRepository(User);

    montserrado = await countyRepo.save(
      countyRepo.create({
        name: "Montserrado",
        slug: "montserrado",
        rolloutStage: 1,
      }),
    );
    cultureCategory = await categoryRepo.save(
      categoryRepo.create({
        name: "Culture & Heritage",
        slug: "culture-heritage",
        icon: "🏛️",
      }),
    );

    hotelPlace = await placeRepo.save(
      placeRepo.create({
        name: "Test Hotel",
        slug: "test-hotel-p3",
        description: "A hotel for Phase 3 e2e testing.",
        type: PlaceType.HOTEL,
        category: cultureCategory,
        tags: [],
        county: montserrado,
        city: "Monrovia",
        latitude: 6.29,
        longitude: -10.79,
        recommendedVisitLength: RecommendedVisitLength.OVERNIGHT,
        verificationStatus: VerificationStatus.UNVERIFIED,
      }),
    );
    unclaimedPlace = await placeRepo.save(
      placeRepo.create({
        name: "Test Landmark",
        slug: "test-landmark-p3",
        description: "An unclaimed landmark for Phase 3 e2e testing.",
        type: PlaceType.ATTRACTION,
        category: cultureCategory,
        tags: [],
        county: montserrado,
        city: "Monrovia",
        latitude: 6.3,
        longitude: -10.8,
        verificationStatus: VerificationStatus.UNVERIFIED,
      }),
    );

    const guest = await registerUser("guest@example.com", "Guest");
    guestToken = guest.token;
    const owner = await registerUser("owner@example.com", "Owner");
    ownerToken = owner.token;
    const admin = await registerUser("admin@example.com", "Admin");
    adminToken = admin.token;
    await userRepo.update({ id: admin.id }, { isAdmin: true });
    const stranger = await registerUser("stranger@example.com", "Stranger");
    strangerToken = stranger.token;
    const superAdmin = await registerUser(
      "superadmin@example.com",
      "Super Admin",
    );
    superAdminToken = superAdmin.token;
    superAdminId = superAdmin.id;
    await userRepo.update(
      { id: superAdmin.id },
      { isAdmin: true, isSuperAdmin: true },
    );

    const claim = await request(app.getHttpServer())
      .post("/api/v1/businesses")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        placeId: hotelPlace.id,
        name: "Test Hotel Business",
        type: "hotel",
      })
      .expect(201);
    hotelBusinessId = claim.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Bookings", () => {
    let bookingId: string;

    it("creates a booking request, lists it both ways, and enforces ownership on the business queue", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          businessId: hotelBusinessId,
          requestedDate: "2027-01-10",
          requestedEndDate: "2027-01-12",
          partySize: 2,
        })
        .expect(201);
      bookingId = create.body.id;
      expect(create.body.status).toBe("pending");
      expect(create.body.paymentStatus).toBe("unpaid");
      expect(create.body.guest.passwordHash).toBeUndefined();
      expect(create.body.business.owner.passwordHash).toBeUndefined();

      const mine = await request(app.getHttpServer())
        .get("/api/v1/bookings/mine")
        .set("Authorization", `Bearer ${guestToken}`)
        .expect(200);
      expect(mine.body).toHaveLength(1);

      await request(app.getHttpServer())
        .get(`/api/v1/bookings/business/${hotelBusinessId}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      const queue = await request(app.getHttpServer())
        .get(`/api/v1/bookings/business/${hotelBusinessId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);
      expect(queue.body).toHaveLength(1);
    });

    it("rejects a request date in the past", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ businessId: hotelBusinessId, requestedDate: "2020-01-01" })
        .expect(400);
    });

    it("lets the owner confirm once, rejects a second response, and lets the guest cancel", async () => {
      const confirm = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/respond`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ action: "confirm", message: "See you then!" })
        .expect(200);
      expect(confirm.body.status).toBe("confirmed");

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/respond`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ action: "decline" })
        .expect(409);

      const cancel = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${bookingId}/cancel`)
        .set("Authorization", `Bearer ${guestToken}`)
        .expect(200);
      expect(cancel.body.status).toBe("cancelled");
    });

    it("404s on an unknown business", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          businessId: "00000000-0000-0000-0000-000000000000",
          requestedDate: "2027-01-10",
        })
        .expect(404);
    });

    it("rejects a booking with neither businessId nor creatorId, and with both", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ requestedDate: "2027-01-10" })
        .expect(400);

      await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          businessId: hotelBusinessId,
          creatorId: "00000000-0000-0000-0000-000000000000",
          requestedDate: "2027-01-10",
        })
        .expect(400);
    });

    it("creates a booking request against a creator, lists it both ways, and enforces ownership on the creator's queue", async () => {
      const creatorOwner = await registerUser(
        "booking-creator-owner@example.com",
        "Booking Creator Owner",
      );
      const creatorRes = await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Authorization", `Bearer ${creatorOwner.token}`)
        .send({ name: "Booking Creator", username: "booking_creator" })
        .expect(201);
      const creatorId = creatorRes.body.id;

      const create = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ creatorId, requestedDate: "2027-02-01", partySize: 1 })
        .expect(201);
      const creatorBookingId = create.body.id;
      expect(create.body.status).toBe("pending");
      expect(create.body.business).toBeNull();
      expect(create.body.creator.user.passwordHash).toBeUndefined();

      await request(app.getHttpServer())
        .get(`/api/v1/bookings/creator/${creatorId}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      const queue = await request(app.getHttpServer())
        .get(`/api/v1/bookings/creator/${creatorId}`)
        .set("Authorization", `Bearer ${creatorOwner.token}`)
        .expect(200);
      expect(queue.body).toHaveLength(1);

      const confirm = await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${creatorBookingId}/respond`)
        .set("Authorization", `Bearer ${creatorOwner.token}`)
        .send({ action: "confirm" })
        .expect(200);
      expect(confirm.body.status).toBe("confirmed");

      // Guest and the business owner from the earlier test can message
      // each other on a business booking; the guest and this creator can
      // do the same on this one — the participant check isn't hardcoded
      // to "business owner".
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${creatorBookingId}/messages`)
        .set("Authorization", `Bearer ${creatorOwner.token}`)
        .send({ body: "Looking forward to it!" })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${creatorBookingId}/messages`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ body: "Not my booking" })
        .expect(403);
    });

    it("404s on an unknown creator", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          creatorId: "00000000-0000-0000-0000-000000000000",
          requestedDate: "2027-01-10",
        })
        .expect(404);
    });
  });

  describe("Booking messages", () => {
    let messagingBookingId: string;

    beforeAll(async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ businessId: hotelBusinessId, requestedDate: "2027-03-01" })
        .expect(201);
      messagingBookingId = create.body.id;
    });

    it("lets the guest post a message and the owner read + reply, in order", async () => {
      const first = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${messagingBookingId}/messages`)
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ body: "What time is check-in?" })
        .expect(201);
      expect(first.body.sender.passwordHash).toBeUndefined();
      expect(first.body.body).toBe("What time is check-in?");

      const reply = await request(app.getHttpServer())
        .post(`/api/v1/bookings/${messagingBookingId}/messages`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ body: "Check-in is at 2pm." })
        .expect(201);
      expect(reply.body.body).toBe("Check-in is at 2pm.");

      const thread = await request(app.getHttpServer())
        .get(`/api/v1/bookings/${messagingBookingId}/messages`)
        .set("Authorization", `Bearer ${guestToken}`)
        .expect(200);
      expect(thread.body).toHaveLength(2);
      expect(thread.body[0].body).toBe("What time is check-in?");
      expect(thread.body[1].body).toBe("Check-in is at 2pm.");
    });

    it("blocks a stranger from posting or reading the thread", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${messagingBookingId}/messages`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ body: "let me in" })
        .expect(403);

      await request(app.getHttpServer())
        .get(`/api/v1/bookings/${messagingBookingId}/messages`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);
    });

    it("404s on a booking that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/bookings/00000000-0000-0000-0000-000000000000/messages")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ body: "hi" })
        .expect(404);
    });

    it("rejects an empty message body", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/bookings/${messagingBookingId}/messages`)
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ body: "" })
        .expect(400);
    });
  });

  describe("Reviews with a confirmed booking (verifiedVisit)", () => {
    it("marks a review verified when the reviewer has a confirmed booking with a linked business", async () => {
      // A fresh booking, independent of the one the Bookings block above
      // mutates through pending → confirmed → cancelled — this one stays
      // confirmed for the review created against it.
      const booking = await request(app.getHttpServer())
        .post("/api/v1/bookings")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ businessId: hotelBusinessId, requestedDate: "2027-02-01" })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/bookings/${booking.body.id}/respond`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ action: "confirm" })
        .expect(200);

      const review = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          placeId: hotelPlace.id,
          overallRating: 5,
          comment: "Great stay.",
        })
        .expect(201);
      expect(review.body.verifiedVisit).toBe(true);
    });

    it("leaves a review unverified with no confirmed booking behind it", async () => {
      const review = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ placeId: hotelPlace.id, overallRating: 3 })
        .expect(201);
      expect(review.body.verifiedVisit).toBe(false);
    });
  });

  describe('Freshness reports ("is this still here?")', () => {
    it("requires auth, 404s an unknown place, and upserts instead of duplicating", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/freshness-reports")
        .send({ placeId: unclaimedPlace.id, response: "still_here" })
        .expect(401);

      await request(app.getHttpServer())
        .post("/api/v1/freshness-reports")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          placeId: "00000000-0000-0000-0000-000000000000",
          response: "still_here",
        })
        .expect(404);

      const first = await request(app.getHttpServer())
        .post("/api/v1/freshness-reports")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ placeId: unclaimedPlace.id, response: "still_here" })
        .expect(201);

      const mine = await request(app.getHttpServer())
        .get(`/api/v1/freshness-reports/mine?placeId=${unclaimedPlace.id}`)
        .set("Authorization", `Bearer ${guestToken}`)
        .expect(200);
      expect(mine.body.response).toBe("still_here");

      // A second report from the same user updates the existing row
      // rather than creating a new one.
      const second = await request(app.getHttpServer())
        .post("/api/v1/freshness-reports")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ placeId: unclaimedPlace.id, response: "no_longer_here" })
        .expect(201);
      expect(second.body.id).toBe(first.body.id);

      const mineAfter = await request(app.getHttpServer())
        .get(`/api/v1/freshness-reports/mine?placeId=${unclaimedPlace.id}`)
        .set("Authorization", `Bearer ${guestToken}`)
        .expect(200);
      expect(mineAfter.body.response).toBe("no_longer_here");
    });

    it("flags a place in the admin moderation queue once enough independent reports accumulate", async () => {
      // guestToken already reported "no_longer_here" on unclaimedPlace in
      // the previous test — two more independent reporters cross the
      // FRESHNESS_FLAG_THRESHOLD of 3.
      await request(app.getHttpServer())
        .post("/api/v1/freshness-reports")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ placeId: unclaimedPlace.id, response: "no_longer_here" })
        .expect(201);

      const beforeThreshold = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        beforeThreshold.body.possiblyClosedPlaces.some(
          (p: { place: { id: string } }) => p.place.id === unclaimedPlace.id,
        ),
      ).toBe(false); // only 2 reports so far

      await request(app.getHttpServer())
        .post("/api/v1/freshness-reports")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ placeId: unclaimedPlace.id, response: "no_longer_here" })
        .expect(201);

      const afterThreshold = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      const flagged = afterThreshold.body.possiblyClosedPlaces.find(
        (p: { place: { id: string } }) => p.place.id === unclaimedPlace.id,
      );
      expect(flagged).toBeDefined();
      expect(flagged.noLongerHereCount).toBe(3);
    });
  });

  describe("Analytics", () => {
    it("records public events and aggregates them for the business owner only", async () => {
      for (const eventType of ["view", "view", "save", "contact_click"]) {
        await request(app.getHttpServer())
          .post("/api/v1/analytics/events")
          .send({ placeId: hotelPlace.id, eventType })
          .expect(204);
      }

      await request(app.getHttpServer())
        .get(`/api/v1/analytics/business/${hotelBusinessId}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      const stats = await request(app.getHttpServer())
        .get(`/api/v1/analytics/business/${hotelBusinessId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);
      expect(stats.body.totals).toEqual(
        expect.objectContaining({ view: 2, save: 1, contact_click: 1 }),
      );
    });

    it("404s recording an event for an unknown place", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/analytics/events")
        .send({
          placeId: "00000000-0000-0000-0000-000000000000",
          eventType: "view",
        })
        .expect(404);
    });

    it("rejects an event with neither placeId nor creatorId, and with both", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/analytics/events")
        .send({ eventType: "view" })
        .expect(400);

      await request(app.getHttpServer())
        .post("/api/v1/analytics/events")
        .send({
          placeId: hotelPlace.id,
          creatorId: "00000000-0000-0000-0000-000000000000",
          eventType: "view",
        })
        .expect(400);
    });

    it("records public events for a creator and aggregates them for that creator only", async () => {
      const creatorOwner = await registerUser(
        "analytics-creator-owner@example.com",
        "Analytics Creator Owner",
      );
      const creatorRes = await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Authorization", `Bearer ${creatorOwner.token}`)
        .send({ name: "Analytics Creator", username: "analytics_creator" })
        .expect(201);
      const creatorId = creatorRes.body.id;

      for (const eventType of ["view", "view", "contact_click"]) {
        await request(app.getHttpServer())
          .post("/api/v1/analytics/events")
          .send({ creatorId, eventType })
          .expect(204);
      }

      await request(app.getHttpServer())
        .get(`/api/v1/analytics/creator/${creatorId}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      const stats = await request(app.getHttpServer())
        .get(`/api/v1/analytics/creator/${creatorId}`)
        .set("Authorization", `Bearer ${creatorOwner.token}`)
        .expect(200);
      expect(stats.body.totals).toEqual(
        expect.objectContaining({ view: 2, contact_click: 1 }),
      );

      // A creator's events never leak into the place-scoped business
      // dashboard, and vice versa (hotelPlace already has events recorded
      // in the sibling test above).
      const businessStats = await request(app.getHttpServer())
        .get(`/api/v1/analytics/business/${hotelBusinessId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);
      expect(businessStats.body.totals.view).toBe(2);
    });

    it("404s recording an event for an unknown creator", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/analytics/events")
        .send({
          creatorId: "00000000-0000-0000-0000-000000000000",
          eventType: "view",
        })
        .expect(404);
    });
  });

  describe("Sponsored placements", () => {
    let placementId: string;

    it("is admin-only to create, publicly visible only while active, and revocable", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/sponsored-placements")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          placeId: unclaimedPlace.id,
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        })
        .expect(403);

      const create = await request(app.getHttpServer())
        .post("/api/v1/sponsored-placements")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          placeId: unclaimedPlace.id,
          startDate: "2020-01-01",
          endDate: "2099-12-31",
        })
        .expect(201);
      placementId = create.body.id;

      const active = await request(app.getHttpServer())
        .get("/api/v1/sponsored-placements/active")
        .expect(200);
      expect(active.body.map((p: { id: string }) => p.id)).toContain(
        placementId,
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/sponsored-placements/${placementId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      const activeAfter = await request(app.getHttpServer())
        .get("/api/v1/sponsored-placements/active")
        .expect(200);
      expect(activeAfter.body.map((p: { id: string }) => p.id)).not.toContain(
        placementId,
      );

      // The create + revoke above are both recorded in the admin audit log.
      const auditLog = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-log")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      const entries = auditLog.body.data.filter(
        (a: { targetId: string }) => a.targetId === placementId,
      );
      const actions = entries.map((a: { action: string }) => a.action);
      expect(actions).toContain("sponsored_placement.created");
      expect(actions).toContain("sponsored_placement.revoked");
    });
  });

  describe("Featured creators", () => {
    it("is admin-only to toggle and sorts the directory", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          name: "Featured Test Creator",
          username: "featured_test",
          followerCount: 1,
        })
        .expect(201);
      const creatorId = create.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/creators/${creatorId}/featured`)
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ featured: true })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/creators/${creatorId}/featured`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ featured: true })
        .expect(200);

      const directory = await request(app.getHttpServer())
        .get("/api/v1/creators")
        .expect(200);
      expect(directory.body.data[0].id).toBe(creatorId);
    });
  });

  describe("Admin verification workflow", () => {
    it("stamps an audit trail on the place and business, and updates the moderation queue", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/places/${unclaimedPlace.id}/verification`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ status: "verified" })
        .expect(403);

      const verifyPlace = await request(app.getHttpServer())
        .patch(`/api/v1/admin/places/${unclaimedPlace.id}/verification`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "verified" })
        .expect(200);
      expect(verifyPlace.body.verificationStatus).toBe("verified");
      expect(verifyPlace.body.verifiedAt).not.toBeNull();

      const verifyBusiness = await request(app.getHttpServer())
        .patch(`/api/v1/admin/businesses/${hotelBusinessId}/verification`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "official" })
        .expect(200);
      expect(verifyBusiness.body.verificationStatus).toBe("official");
      expect(verifyBusiness.body.owner.passwordHash).toBeUndefined();

      // hotelBusinessId came from a self-claim, so it's still
      // "submitted_for_review" — a trust-badge change (verificationStatus,
      // above) is orthogonal to the publish/review lifecycle and doesn't
      // touch it. It stays in the moderation queue's pendingBusinesses
      // until an admin acts on the review status specifically.
      const queueBeforeApproval = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        queueBeforeApproval.body.pendingBusinesses.some(
          (b: { id: string }) => b.id === hotelBusinessId,
        ),
      ).toBe(true);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/businesses/${hotelBusinessId}/review-status`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ status: "approved" })
        .expect(403);

      const approveBusiness = await request(app.getHttpServer())
        .patch(`/api/v1/admin/businesses/${hotelBusinessId}/review-status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "approved" })
        .expect(200);
      expect(approveBusiness.body.reviewStatus).toBe("approved");
      expect(approveBusiness.body.rejectionReason).toBeNull();

      const queue = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        queue.body.pendingBusinesses.some(
          (b: { id: string }) => b.id === hotelBusinessId,
        ),
      ).toBe(false); // now "approved" — no longer pending

      // Now approved, the listing is publicly visible again.
      const byPlace = await request(app.getHttpServer())
        .get(`/api/v1/businesses?placeId=${hotelPlace.id}`)
        .expect(200);
      expect(byPlace.body.id).toBe(hotelBusinessId);

      // Reject a fresh claim and confirm the reason comes back, then
      // confirm the owner's next edit auto-resubmits it for review. A
      // brand-new place, not hotelPlace/unclaimedPlace — both already have
      // (or, for unclaimedPlace, later get) a business linked, and only
      // one Business per Place is allowed.
      const placeRepo = dataSource.getRepository(Place);
      const thirdPlace = await placeRepo.save(
        placeRepo.create({
          name: "Test Guesthouse",
          slug: "test-guesthouse",
          description: "A guesthouse for e2e testing.",
          type: PlaceType.HOTEL,
          category: cultureCategory,
          tags: [],
          county: montserrado,
          city: "Monrovia",
          latitude: 6.28,
          longitude: -10.78,
          verificationStatus: VerificationStatus.UNVERIFIED,
        }),
      );
      const secondClaimant = await registerUser(
        "second-claimant@example.com",
        "Second Claimant",
      );
      const secondClaim = await request(app.getHttpServer())
        .post("/api/v1/businesses")
        .set("Authorization", `Bearer ${secondClaimant.token}`)
        .send({ placeId: thirdPlace.id, name: "Guesthouse Biz", type: "hotel" })
        .expect(201);
      const rejected = await request(app.getHttpServer())
        .patch(`/api/v1/admin/businesses/${secondClaim.body.id}/review-status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "rejected", reason: "Phone number looks fake" })
        .expect(200);
      expect(rejected.body.reviewStatus).toBe("rejected");
      expect(rejected.body.rejectionReason).toBe("Phone number looks fake");

      const resubmitted = await request(app.getHttpServer())
        .patch(`/api/v1/businesses/${secondClaim.body.id}`)
        .set("Authorization", `Bearer ${secondClaimant.token}`)
        .send({ phone: "+231770000001" })
        .expect(200);
      expect(resubmitted.body.reviewStatus).toBe("submitted_for_review");
      expect(resubmitted.body.rejectionReason).toBeNull();

      // Both verification changes above are recorded — GET /admin/audit-log
      // is super-admin-only (403 for a plain admin), and every entry's
      // adminUser is the public (sanitized) shape, not a raw User row.
      await request(app.getHttpServer())
        .get("/api/v1/admin/audit-log")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);

      const auditLog = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-log")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      const actions = auditLog.body.data.map(
        (a: { action: string }) => a.action,
      );
      expect(actions).toContain("place.verification_changed");
      expect(actions).toContain("business.verification_changed");
      expect(actions).toContain("business.review_status_changed");
      expect(auditLog.body.data[0].adminUser.passwordHash).toBeUndefined();
    });

    it("lets a user report a business, and it surfaces in the moderation queue's flagged content once enough reports accumulate", async () => {
      const reporters = await Promise.all(
        [
          "biz-reporter-1@example.com",
          "biz-reporter-2@example.com",
          "biz-reporter-3@example.com",
        ].map((email) => registerUser(email, "Business Reporter")),
      );
      for (const reporter of reporters) {
        await request(app.getHttpServer())
          .post("/api/v1/reports")
          .set("Authorization", `Bearer ${reporter.token}`)
          .send({
            targetType: "business",
            targetId: hotelBusinessId,
            reason: "fraudulent",
          })
          .expect(201);
      }

      const queue = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      const flagged = queue.body.flaggedContent.find(
        (f: { targetType: string; targetId: string }) =>
          f.targetType === "business" && f.targetId === hotelBusinessId,
      );
      expect(flagged).toBeDefined();
      expect(flagged.reportCount).toBe(3);
      expect(flagged.reasons.fraudulent).toBe(3);
      expect(flagged.business.id).toBe(hotelBusinessId);
    });

    it("admin-only GET /admin/businesses lists every review status, unlike the public directory", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/businesses")
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      const all = await request(app.getHttpServer())
        .get("/api/v1/admin/businesses")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      // hotelBusinessId (approved, above) AND the rejected-then-resubmitted
      // secondClaim business are both visible here — the public directory
      // would only ever show the approved one.
      const ids = all.body.data.map((b: { id: string }) => b.id);
      expect(ids).toContain(hotelBusinessId);

      const rejectedOnly = await request(app.getHttpServer())
        .get("/api/v1/admin/businesses?reviewStatus=submitted_for_review")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        rejectedOnly.body.data.every(
          (b: { reviewStatus: string }) =>
            b.reviewStatus === "submitted_for_review",
        ),
      ).toBe(true);

      const reportedOnly = await request(app.getHttpServer())
        .get("/api/v1/admin/businesses?reportedOnly=true")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        reportedOnly.body.data.some(
          (b: { id: string }) => b.id === hotelBusinessId,
        ),
      ).toBe(true);
    });

    it("verifies a creator, stamping the same audit trail as places/businesses", async () => {
      // A fresh user, not strangerToken — strangerToken already created a
      // creator profile in the "Featured creators" describe above, and a
      // user can only have one (POST /creators 409s on a second).
      const toBeVerified = await registerUser(
        "verify-me@example.com",
        "Verify Me",
      );
      const create = await request(app.getHttpServer())
        .post("/api/v1/creators")
        .set("Authorization", `Bearer ${toBeVerified.token}`)
        .send({ name: "Verify Me", username: "verify_me_creator" })
        .expect(201);
      const creatorId = create.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/creators/${creatorId}/verification`)
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ status: "verified" })
        .expect(403);

      const verifyCreator = await request(app.getHttpServer())
        .patch(`/api/v1/admin/creators/${creatorId}/verification`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "verified" })
        .expect(200);
      expect(verifyCreator.body.verificationStatus).toBe("verified");
      expect(verifyCreator.body.verifiedAt).not.toBeNull();
      expect(verifyCreator.body.user.passwordHash).toBeUndefined();

      const publicProfile = await request(app.getHttpServer())
        .get("/api/v1/creators/verify_me_creator")
        .expect(200);
      expect(publicProfile.body.verificationStatus).toBe("verified");

      const auditLog = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-log")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(
        auditLog.body.data.map((a: { action: string }) => a.action),
      ).toContain("creator.verification_changed");
    });
  });

  describe("Business content", () => {
    it("goes draft → submitted (hidden) → approved (public), and a rejected item resubmits on edit", async () => {
      // hotelBusinessId is owned by ownerToken (claimed earlier in this
      // spec) and was approved in the "Admin verification workflow" block
      // above.
      await request(app.getHttpServer())
        .post("/api/v1/business-content")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          businessId: hotelBusinessId,
          type: "offer",
          title: "20% off weekday stays",
          body: "Book Mon-Thu and save.",
        })
        .expect(403);

      const draft = await request(app.getHttpServer())
        .post("/api/v1/business-content")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          businessId: hotelBusinessId,
          type: "offer",
          title: "20% off weekday stays",
          body: "Book Mon-Thu and save.",
        })
        .expect(201);
      expect(draft.body.status).toBe("draft");
      const contentId = draft.body.id;

      // Not visible publicly while still a draft.
      const publicBeforeSubmit = await request(app.getHttpServer())
        .get(`/api/v1/business-content?businessId=${hotelBusinessId}`)
        .expect(200);
      expect(publicBeforeSubmit.body.data).toHaveLength(0);

      const submitted = await request(app.getHttpServer())
        .post(`/api/v1/business-content/${contentId}/submit`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(201);
      expect(submitted.body.status).toBe("submitted_for_review");

      // Still not public while pending review.
      const publicWhilePending = await request(app.getHttpServer())
        .get(`/api/v1/business-content?businessId=${hotelBusinessId}`)
        .expect(200);
      expect(publicWhilePending.body.data).toHaveLength(0);

      // Shows up in the moderation queue.
      const queueBeforeApproval = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        queueBeforeApproval.body.pendingBusinessContent.some(
          (c: { id: string }) => c.id === contentId,
        ),
      ).toBe(true);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/business-content/${contentId}/review-status`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ status: "approved" })
        .expect(403);

      const approved = await request(app.getHttpServer())
        .patch(`/api/v1/admin/business-content/${contentId}/review-status`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "approved" })
        .expect(200);
      expect(approved.body.status).toBe("approved");

      // Now public.
      const publicAfterApproval = await request(app.getHttpServer())
        .get(`/api/v1/business-content?businessId=${hotelBusinessId}`)
        .expect(200);
      expect(
        publicAfterApproval.body.data.map((c: { id: string }) => c.id),
      ).toContain(contentId);

      // No longer pending.
      const queueAfterApproval = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        queueAfterApproval.body.pendingBusinessContent.some(
          (c: { id: string }) => c.id === contentId,
        ),
      ).toBe(false);

      // A second item, rejected with a reason, then resubmitted on edit.
      const secondDraft = await request(app.getHttpServer())
        .post("/api/v1/business-content")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          businessId: hotelBusinessId,
          type: "travel_tip",
          body: "Bring cash — cards aren't widely accepted here.",
          title: "Cash tip",
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/business-content/${secondDraft.body.id}/submit`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(201);

      const rejected = await request(app.getHttpServer())
        .patch(
          `/api/v1/admin/business-content/${secondDraft.body.id}/review-status`,
        )
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "rejected", reason: "Not specific to this business" })
        .expect(200);
      expect(rejected.body.status).toBe("rejected");
      expect(rejected.body.rejectionReason).toBe(
        "Not specific to this business",
      );

      const resubmittedOnEdit = await request(app.getHttpServer())
        .patch(`/api/v1/business-content/${secondDraft.body.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Cash tip (updated)" })
        .expect(200);
      expect(resubmittedOnEdit.body.status).toBe("submitted_for_review");
      expect(resubmittedOnEdit.body.rejectionReason).toBeNull();

      // The owner can delete their own item at any point.
      await request(app.getHttpServer())
        .delete(`/api/v1/business-content/${secondDraft.body.id}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .delete(`/api/v1/business-content/${secondDraft.body.id}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(204);

      const auditLog = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-log")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(
        auditLog.body.data.map((a: { action: string }) => a.action),
      ).toContain("business_content.review_status_changed");
    });
  });

  describe("Content reporting & moderation", () => {
    let reportedReview: { id: string; overallRating: number };
    let reportedEvent: { id: string };

    beforeAll(async () => {
      // unclaimedPlace, not hotelPlace — guestToken/strangerToken have
      // already each reviewed hotelPlace once earlier in this spec, and
      // reviews are one-per-user-per-place.
      const review = await request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          placeId: unclaimedPlace.id,
          overallRating: 4,
          comment: "Fine.",
        })
        .expect(201);
      reportedReview = review.body;

      const event = await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          name: "Sketchy Promo Event",
          category: "other",
          locationText: "TBD",
          countyId: montserrado.id,
          startDate: "2027-06-01T00:00:00.000Z",
        })
        .expect(201);
      reportedEvent = event.body;
    });

    it("rejects reporting a target that doesn't exist", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/reports")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          targetType: "review",
          targetId: "00000000-0000-0000-0000-000000000000",
          reason: "spam",
        })
        .expect(404);
    });

    it("upserts on a second report from the same user for the same target", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/reports")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          targetType: "review",
          targetId: reportedReview.id,
          reason: "spam",
        })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post("/api/v1/reports")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          targetType: "review",
          targetId: reportedReview.id,
          reason: "fake",
          details: "changed my mind",
        })
        .expect(201);
      expect(second.body.reason).toBe("fake");
    });

    it("surfaces a review/event in the moderation queue once 3+ distinct users report it, and lets an admin remove it", async () => {
      // strangerToken already reported reportedReview above (as "fake").
      // Two more distinct users push it past the threshold.
      const secondReporter = await registerUser(
        "reporter2@example.com",
        "Reporter Two",
      );
      const thirdReporter = await registerUser(
        "reporter3@example.com",
        "Reporter Three",
      );
      for (const reporter of [secondReporter, thirdReporter]) {
        await request(app.getHttpServer())
          .post("/api/v1/reports")
          .set("Authorization", `Bearer ${reporter.token}`)
          .send({
            targetType: "review",
            targetId: reportedReview.id,
            reason: "inappropriate",
          })
          .expect(201);
        await request(app.getHttpServer())
          .post("/api/v1/reports")
          .set("Authorization", `Bearer ${reporter.token}`)
          .send({
            targetType: "event",
            targetId: reportedEvent.id,
            reason: "spam",
          })
          .expect(201);
      }
      // Third report on the event too (strangerToken hasn't reported it yet).
      await request(app.getHttpServer())
        .post("/api/v1/reports")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          targetType: "event",
          targetId: reportedEvent.id,
          reason: "spam",
        })
        .expect(201);

      const queue = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      const flagged: Array<{
        targetType: string;
        targetId: string;
        reportCount: number;
        reasons: Record<string, number>;
        review: { id: string } | null;
        event: { id: string } | null;
      }> = queue.body.flaggedContent;

      const flaggedReview = flagged.find(
        (f) => f.targetType === "review" && f.targetId === reportedReview.id,
      );
      expect(flaggedReview?.reportCount).toBe(3);
      expect(flaggedReview?.review?.id).toBe(reportedReview.id);
      expect(flaggedReview?.reasons.inappropriate).toBe(2);
      expect(flaggedReview?.reasons.fake).toBe(1);

      const flaggedEvent = flagged.find(
        (f) => f.targetType === "event" && f.targetId === reportedEvent.id,
      );
      expect(flaggedEvent?.reportCount).toBe(3);
      expect(flaggedEvent?.event?.id).toBe(reportedEvent.id);

      // A plain admin can act on it; removal is audit-logged.
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/reviews/${reportedReview.id}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/reviews/${reportedReview.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/api/v1/admin/events/${reportedEvent.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/events/${reportedEvent.id}`)
        .expect(404);

      const auditLog = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-log")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      const actions = auditLog.body.data.map(
        (a: { action: string }) => a.action,
      );
      expect(actions).toContain("review.removed");
      expect(actions).toContain("event.removed");
    });
  });

  describe("Admin content management", () => {
    it("creates and updates a Place, rejecting a duplicate slug and an unknown category", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/admin/places")
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({
          name: "X",
          slug: "x-place",
          description: "x",
          type: "attraction",
          categoryId: cultureCategory.id,
          countyId: montserrado.id,
          city: "Monrovia",
          latitude: 6.3,
          longitude: -10.8,
        })
        .expect(403);

      const create = await request(app.getHttpServer())
        .post("/api/v1/admin/places")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Admin Created Place",
          slug: "admin-created-place",
          description: "Created via admin content API.",
          type: "attraction",
          categoryId: cultureCategory.id,
          countyId: montserrado.id,
          city: "Monrovia",
          latitude: 6.31,
          longitude: -10.81,
        })
        .expect(201);
      const placeId = create.body.id;

      await request(app.getHttpServer())
        .post("/api/v1/admin/places")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Dup",
          slug: "admin-created-place",
          description: "dup",
          type: "attraction",
          categoryId: cultureCategory.id,
          countyId: montserrado.id,
          city: "Monrovia",
          latitude: 6.3,
          longitude: -10.8,
        })
        .expect(409);

      await request(app.getHttpServer())
        .post("/api/v1/admin/places")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Y",
          slug: "y-place",
          description: "y",
          type: "attraction",
          categoryId: "00000000-0000-0000-0000-000000000000",
          countyId: montserrado.id,
          city: "Monrovia",
          latitude: 6.3,
          longitude: -10.8,
        })
        .expect(404);

      const update = await request(app.getHttpServer())
        .patch(`/api/v1/admin/places/${placeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ featured: true })
        .expect(200);
      expect(update.body.featured).toBe(true);

      // Regression test: reassigning a place's county/category from the
      // admin panel appeared to succeed but silently kept the OLD value
      // (TypeORM prioritizes an eager-loaded relation object over the
      // merged scalar FK column — see clearStaleRelation's doc comment).
      // Assert against a fresh GET, not just the PATCH response, since the
      // bug only shows up in what's actually persisted.
      const bong = await dataSource.getRepository(County).save(
        dataSource.getRepository(County).create({
          name: "Bong",
          slug: "bong",
          rolloutStage: 2,
        }),
      );
      const nature = await dataSource.getRepository(Category).save(
        dataSource.getRepository(Category).create({
          name: "Nature",
          slug: "nature",
          icon: "🌿",
        }),
      );
      const reassigned = await request(app.getHttpServer())
        .patch(`/api/v1/admin/places/${placeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ countyId: bong.id, categoryId: nature.id })
        .expect(200);
      expect(reassigned.body.county.id).toBe(bong.id);
      expect(reassigned.body.category.id).toBe(nature.id);

      const reloaded = await request(app.getHttpServer())
        .get(`/api/v1/admin/places/${placeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(reloaded.body.county.id).toBe(bong.id);
      expect(reloaded.body.category.id).toBe(nature.id);
    });

    it("flags a place whose slug doesn't match its name in the data-quality audit, requires admin, and clears once fixed", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/places/data-quality")
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      const create = await request(app.getHttpServer())
        .post("/api/v1/admin/places")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Nimba Ecolodge",
          slug: "kpatawee-waterfall",
          description:
            "A cozy ecolodge near Mount Nimba, with guided hikes and simple rooms.",
          type: "hotel",
          categoryId: cultureCategory.id,
          countyId: montserrado.id,
          city: "Sanniquellie",
          latitude: 7.36,
          longitude: -8.72,
          images: ["https://example.com/nimba-ecolodge.jpg"],
        })
        .expect(201);
      const placeId = create.body.id;

      const flagged = await request(app.getHttpServer())
        .get("/api/v1/admin/places/data-quality")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      const flaggedEntry = flagged.body.find(
        (entry: { place: { id: string } }) => entry.place.id === placeId,
      );
      expect(flaggedEntry).toBeDefined();
      expect(flaggedEntry.issues.some((i: string) => i.includes("Slug"))).toBe(
        true,
      );

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/places/${placeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ slug: "nimba-ecolodge" })
        .expect(200);

      const cleared = await request(app.getHttpServer())
        .get("/api/v1/admin/places/data-quality")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        cleared.body.some(
          (entry: { place: { id: string } }) => entry.place.id === placeId,
        ),
      ).toBe(false);
    });

    it("creates an activity under a place and updates it", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/admin/activities")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ placeId: hotelPlace.id, name: "Test Activity", price: 10 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/activities/${create.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ price: 15 })
        .expect(200)
        .expect((res) => {
          if (res.body.price !== 15) throw new Error("price not updated");
        });
    });

    it("creates an unowned business shell, claimable via the existing claim endpoint", async () => {
      const create = await request(app.getHttpServer())
        .post("/api/v1/admin/businesses")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          placeId: unclaimedPlace.id,
          name: "Seeded Business",
          type: "tour_operator",
        })
        .expect(201);
      expect(create.body.owner).toBeNull();

      await request(app.getHttpServer())
        .post(`/api/v1/businesses/${create.body.id}/claim`)
        .set("Authorization", `Bearer ${guestToken}`)
        .expect(201)
        .expect((res) => {
          if (!res.body.owner) throw new Error("business was not claimed");
        });

      // Regression test: an admin reassigning or clearing a business's
      // owner (see UpdateBusinessAdminDto's doc comment) appeared to
      // succeed but silently kept the OLD owner — same
      // eager-relation-vs-scalar-FK hazard as the Place county/category
      // regression above (`owner` is `eager: true` on Business too). A
      // fresh place + shell + owner, not the business/guestToken above —
      // guestToken's business claim needs to stay intact for the "edits
      // an event" test below (POST /events requires a claimed business,
      // creator profile, or admin), and a place can only have one linked
      // business.
      const secondPlace = await dataSource.getRepository(Place).save(
        dataSource.getRepository(Place).create({
          name: "Second Unclaimed Landmark",
          slug: "second-unclaimed-landmark-p3",
          description: "For the owner-reassignment regression test.",
          type: PlaceType.ATTRACTION,
          category: cultureCategory,
          tags: [],
          county: montserrado,
          city: "Monrovia",
          latitude: 6.32,
          longitude: -10.82,
          verificationStatus: VerificationStatus.UNVERIFIED,
        }),
      );
      const secondShell = await request(app.getHttpServer())
        .post("/api/v1/admin/businesses")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          placeId: secondPlace.id,
          name: "Second Seeded Business",
          type: "tour_operator",
        })
        .expect(201);
      const otherUser = await registerUser(
        "reassigned-owner@example.com",
        "Reassigned Owner",
      );
      const reassigned = await request(app.getHttpServer())
        .patch(`/api/v1/admin/businesses/${secondShell.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ownerUserId: otherUser.id })
        .expect(200);
      expect(reassigned.body.owner.id).toBe(otherUser.id);

      const unclaimed = await request(app.getHttpServer())
        .patch(`/api/v1/admin/businesses/${secondShell.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ ownerUserId: null })
        .expect(200);
      expect(unclaimed.body.owner).toBeNull();
    });

    it("edits an event, rejecting an update that violates the location invariant", async () => {
      const event = await request(app.getHttpServer())
        .post("/api/v1/events")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({
          name: "Original Event",
          category: "festival",
          countyId: montserrado.id,
          locationText: "Test Venue",
          startDate: "2027-02-01T18:00:00Z",
        })
        .expect(201);

      const update = await request(app.getHttpServer())
        .patch(`/api/v1/admin/events/${event.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Corrected Event" })
        .expect(200);
      expect(update.body.name).toBe("Corrected Event");
      expect(update.body.createdBy.passwordHash).toBeUndefined();

      await request(app.getHttpServer())
        .patch(`/api/v1/admin/events/${event.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ endDate: "2020-01-01T00:00:00Z" })
        .expect(400);

      // Regression test: reassigning an event's place/county from the
      // admin panel appeared to succeed but silently kept the OLD value —
      // same eager-relation-vs-scalar-FK hazard as the Place/Business
      // regressions above (`place`/`county` are both `eager: true` on
      // Event too).
      const reassigned = await request(app.getHttpServer())
        .patch(`/api/v1/admin/events/${event.body.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ placeId: unclaimedPlace.id })
        .expect(200);
      expect(reassigned.body.place.id).toBe(unclaimedPlace.id);
      expect(reassigned.body.placeId).toBe(unclaimedPlace.id);
    });

    it("updates a county's safety & practical-info panel, admin-only", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/counties/${montserrado.id}`)
        .set("Authorization", `Bearer ${strangerToken}`)
        .send({ emergencyNumber: "911" })
        .expect(403);

      const update = await request(app.getHttpServer())
        .patch(`/api/v1/admin/counties/${montserrado.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          emergencyNumber: "911",
          safetyTips: ["Agree on taxi fares before getting in."],
          localCustoms: "Greet before getting to business.",
        })
        .expect(200);
      expect(update.body.emergencyNumber).toBe("911");
      expect(update.body.safetyTips).toEqual([
        "Agree on taxi fares before getting in.",
      ]);

      const publicRead = await request(app.getHttpServer())
        .get("/api/v1/counties")
        .expect(200);
      const found = publicRead.body.find(
        (c: { id: string }) => c.id === montserrado.id,
      );
      expect(found.emergencyNumber).toBe("911");

      await request(app.getHttpServer())
        .patch("/api/v1/admin/counties/00000000-0000-0000-0000-000000000000")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ emergencyNumber: "911" })
        .expect(404);
    });
  });

  describe("B2B aggregate analytics", () => {
    it("is admin-only and returns ordered breakdowns", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/aggregate")
        .set("Authorization", `Bearer ${strangerToken}`)
        .expect(403);

      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/aggregate")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.topPlaces.length).toBeGreaterThan(0);
      expect(res.body.byCategory.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .get("/api/v1/admin/analytics/aggregate?limit=999")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe("Profile — traveler type, interests, PATCH /auth/me", () => {
    it("accepts travelerType/interests at registration and returns them on /auth/me", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          name: "Profile Tester",
          email: "profile-tester@example.com",
          password: "password123",
          travelerType: "diaspora",
          interests: ["beaches", "culture-heritage"],
        })
        .expect(201);
      expect(res.body.user.travelerType).toBe("diaspora");
      expect(res.body.user.interests).toEqual(["beaches", "culture-heritage"]);
      expect(res.body.user.isSuperAdmin).toBe(false);

      const me = await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body.travelerType).toBe("diaspora");
    });

    it("lets a signed-in user update their own profile via PATCH /auth/me", async () => {
      const patched = await request(app.getHttpServer())
        .patch("/api/v1/auth/me")
        .set("Authorization", `Bearer ${guestToken}`)
        .send({ travelerType: "tourist", interests: ["hiking-adventure"] })
        .expect(200);
      expect(patched.body.travelerType).toBe("tourist");
      expect(patched.body.interests).toEqual(["hiking-adventure"]);
    });

    it("rejects an unauthenticated profile update", async () => {
      await request(app.getHttpServer())
        .patch("/api/v1/auth/me")
        .send({ travelerType: "tourist" })
        .expect(401);
    });
  });

  describe("Admin Team & Access (super admin only)", () => {
    let plainUserId: string;
    let plainUserToken: string;

    beforeAll(async () => {
      const plain = await registerUser("team-plain@example.com", "Team Plain");
      plainUserId = plain.id;
      plainUserToken = plain.token;
    });

    it("blocks a regular admin (not super admin) from every team endpoint", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/team")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/team/${plainUserId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isAdmin: true, isSuperAdmin: false })
        .expect(403);
    });

    it("lets a super admin promote a user to admin, and it takes effect immediately", async () => {
      const promoted = await request(app.getHttpServer())
        .patch(`/api/v1/admin/team/${plainUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ isAdmin: true, isSuperAdmin: false })
        .expect(200);
      expect(promoted.body.isAdmin).toBe(true);
      expect(promoted.body.isSuperAdmin).toBe(false);

      // No re-login needed — the JWT strategy re-fetches the user on every
      // request (see api/README.md's admin-access note).
      await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${plainUserToken}`)
        .expect(200);
    });

    it("finds a team member by email and lists the full roster", async () => {
      const found = await request(app.getHttpServer())
        .get("/api/v1/admin/team/search")
        .query({ email: "team-plain@example.com" })
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(found.body.id).toBe(plainUserId);

      const roster = await request(app.getHttpServer())
        .get("/api/v1/admin/team")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      const emails = roster.body.map((u: { email: string }) => u.email);
      expect(emails).toContain("team-plain@example.com");
      expect(emails).toContain("superadmin@example.com");
    });

    it("404s a search for an email with no account", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/team/search")
        .query({ email: "nobody@example.com" })
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it("blocks a super admin from removing their own super-admin access", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/team/${superAdminId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ isAdmin: true, isSuperAdmin: false })
        .expect(400);
    });

    it("demotes a plain admin back to a regular user", async () => {
      const demoted = await request(app.getHttpServer())
        .patch(`/api/v1/admin/team/${plainUserId}`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({ isAdmin: false, isSuperAdmin: false })
        .expect(200);
      expect(demoted.body.isAdmin).toBe(false);

      await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${plainUserToken}`)
        .expect(403);
    });
  });

  describe("Platform KPIs (super admin only)", () => {
    it("blocks a regular admin", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/kpis")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
    });

    it("returns real, non-negative platform numbers to a super admin", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/admin/kpis")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(res.body.totalUsers).toBeGreaterThan(0);
      expect(res.body.totalPlaces).toBeGreaterThan(0);
      expect(res.body.businessClaimRate).toBeGreaterThanOrEqual(0);
      expect(res.body.businessClaimRate).toBeLessThanOrEqual(1);
      expect(res.body.bookingsByStatus).toEqual(
        expect.objectContaining({
          pending: expect.any(Number),
          confirmed: expect.any(Number),
          declined: expect.any(Number),
          cancelled: expect.any(Number),
        }),
      );
    });
  });

  describe("Security — login activity, overview, and session revocation (super admin only)", () => {
    it("blocks a regular admin from every security endpoint", async () => {
      await request(app.getHttpServer())
        .get("/api/v1/admin/security/login-activity")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get("/api/v1/admin/security/overview")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .post(`/api/v1/admin/security/users/${superAdminId}/revoke-sessions`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(403);
    });

    it("records a failed and a successful login attempt, with device info, visible to a super admin", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("User-Agent", "Phase3E2E/1.0")
        .send({ email: "security-e2e@example.com", password: "wrong" })
        .expect(401);

      await registerUser("security-e2e@example.com", "Security E2E");
      await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .set("User-Agent", "Phase3E2E/1.0")
        .send({ email: "security-e2e@example.com", password: "password123" })
        .expect(200);

      const activity = await request(app.getHttpServer())
        .get("/api/v1/admin/security/login-activity")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      const forThisEmail = activity.body.data.filter(
        (a: { emailAttempted: string }) =>
          a.emailAttempted === "security-e2e@example.com",
      );
      expect(forThisEmail.some((a: { success: boolean }) => a.success)).toBe(
        true,
      );
      expect(forThisEmail.some((a: { success: boolean }) => !a.success)).toBe(
        true,
      );
      expect(forThisEmail[0].userAgent).toBe("Phase3E2E/1.0");

      const failedOnly = await request(app.getHttpServer())
        .get("/api/v1/admin/security/login-activity")
        .query({ onlyFailed: "true" })
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(
        failedOnly.body.data.every((a: { success: boolean }) => !a.success),
      ).toBe(true);

      const overview = await request(app.getHttpServer())
        .get("/api/v1/admin/security/overview")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      expect(overview.body.failedLoginsLast24h).toBeGreaterThan(0);
      expect(overview.body.adminTwoFactorAdoption.total).toBeGreaterThan(0);
    });

    it("revokes a user's sessions — their existing token stops working, and it's audit-logged", async () => {
      const target = await registerUser(
        "revoke-target@example.com",
        "Revoke Target",
      );

      // The token from registration works until revoked.
      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${target.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/admin/security/users/${target.id}/revoke-sessions`)
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${target.token}`)
        .expect(401);

      const auditLog = await request(app.getHttpServer())
        .get("/api/v1/admin/audit-log")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .expect(200);
      const entry = auditLog.body.data.find(
        (a: { targetId: string; action: string }) =>
          a.targetId === target.id && a.action === "user.sessions_revoked",
      );
      expect(entry).toBeDefined();
    });
  });
});
