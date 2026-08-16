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
    app.setGlobalPrefix("api/v1", { exclude: ["health"] });
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

      const queue = await request(app.getHttpServer())
        .get("/api/v1/admin/moderation-queue")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(
        queue.body.pendingBusinesses.some(
          (b: { id: string }) => b.id === hotelBusinessId,
        ),
      ).toBe(false); // now "official", not "unverified" — no longer pending
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
});
