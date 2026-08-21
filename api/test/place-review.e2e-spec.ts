import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { County } from "../src/counties/entities/county.entity";
import { Category } from "../src/categories/entities/category.entity";
import { User } from "../src/users/entities/user.entity";

// Self-contained (own full reset in beforeAll), same rationale as
// phase2/phase3.e2e-spec.ts — test/jest-e2e.json's maxWorkers: 1
// serializes e2e spec files against the shared test DB.
//
// Covers the self-service Place submission + admin review-gate lifecycle
// end to end: a regular user submits a brand-new place the same way an
// admin can via POST /admin/places, it stays invisible to the public
// catalog until an admin reviews and approves it, and the admin review
// surface (GET /admin/places, PATCH .../review-status) sees everything a
// submitter provided.
describe("Place self-service submission + review gate (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let montserrado: County;
  let natureCategory: Category;

  let submitterToken: string;
  let submitterId: string;
  let strangerToken: string;
  let adminToken: string;

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

  const submissionPayload = {
    name: "Kpatawee Waterfall",
    description: "A scenic waterfall near Gbarnga, popular for day trips.",
    type: "nature_site",
    city: "Gbarnga",
    latitude: 6.9,
    longitude: -9.4,
    tags: ["waterfall", "hiking"],
    contactPhone: "+231770000099",
  };

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
      "TRUNCATE TABLE activities, places, categories, counties, users RESTART IDENTITY CASCADE",
    );

    const countyRepo = dataSource.getRepository(County);
    const categoryRepo = dataSource.getRepository(Category);
    const userRepo = dataSource.getRepository(User);

    montserrado = await countyRepo.save(
      countyRepo.create({ name: "Bong", slug: "bong", rolloutStage: 1 }),
    );
    natureCategory = await categoryRepo.save(
      categoryRepo.create({ name: "Nature", slug: "nature", icon: "🌿" }),
    );

    const submitter = await registerUser(
      "place-submitter@example.com",
      "Place Submitter",
    );
    submitterToken = submitter.token;
    submitterId = submitter.id;
    const stranger = await registerUser(
      "place-stranger@example.com",
      "Place Stranger",
    );
    strangerToken = stranger.token;
    const admin = await registerUser("place-admin@example.com", "Place Admin");
    adminToken = admin.token;
    await userRepo.update({ id: admin.id }, { isAdmin: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires auth to submit a place", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/places")
      .send({
        ...submissionPayload,
        categoryId: natureCategory.id,
        countyId: montserrado.id,
      })
      .expect(401);
  });

  let placeId: string;
  let placeSlug: string;

  it("lets a signed-in user submit a new place, starting hidden from the public catalog", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/places")
      .set("Authorization", `Bearer ${submitterToken}`)
      .send({
        ...submissionPayload,
        categoryId: natureCategory.id,
        countyId: montserrado.id,
      })
      .expect(201);

    expect(res.body.reviewStatus).toBe("submitted_for_review");
    expect(res.body.slug).toBe("kpatawee-waterfall");
    expect(res.body.submittedAt).not.toBeNull();
    placeId = res.body.id;
    placeSlug = res.body.slug;

    // Not in the public catalog yet.
    const list = await request(app.getHttpServer())
      .get("/api/v1/places")
      .expect(200);
    expect(list.body.data.some((p: { id: string }) => p.id === placeId)).toBe(
      false,
    );

    // Not reachable by slug either.
    await request(app.getHttpServer())
      .get(`/api/v1/places/${placeSlug}`)
      .expect(404);
  });

  it("lets the submitter see their own pending place via GET /places/mine", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/places/mine")
      .set("Authorization", `Bearer ${submitterToken}`)
      .expect(200);
    expect(res.body.some((p: { id: string }) => p.id === placeId)).toBe(true);

    // A stranger's "mine" list doesn't see someone else's submission.
    const strangerMine = await request(app.getHttpServer())
      .get("/api/v1/places/mine")
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(200);
    expect(
      strangerMine.body.some((p: { id: string }) => p.id === placeId),
    ).toBe(false);
  });

  it("blocks a non-owner from editing the submission", async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/places/${placeId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ description: "Hijacked description" })
      .expect(403);
  });

  it("404s the admin place-review endpoints for a non-admin", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/places")
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/places/${placeId}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/places/${placeId}/review-status`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ status: "approved" })
      .expect(403);
  });

  it("shows the admin everything the submitter provided, including who submitted it", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/v1/admin/places?reviewStatus=submitted_for_review")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const row = list.body.data.find((p: { id: string }) => p.id === placeId);
    expect(row).toBeDefined();
    expect(row.owner.id).toBe(submitterId);
    expect(row.owner.passwordHash).toBeUndefined();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/places/${placeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.name).toBe(submissionPayload.name);
    expect(detail.body.description).toBe(submissionPayload.description);
    expect(detail.body.contactPhone).toBe(submissionPayload.contactPhone);
    expect(detail.body.tags).toEqual(submissionPayload.tags);
    expect(detail.body.owner.name).toBe("Place Submitter");
    expect(detail.body.owner.passwordHash).toBeUndefined();
  });

  it("approves the submission, making it public", async () => {
    const approved = await request(app.getHttpServer())
      .patch(`/api/v1/admin/places/${placeId}/review-status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" })
      .expect(200);
    expect(approved.body.reviewStatus).toBe("approved");
    expect(approved.body.rejectionReason).toBeNull();

    const bySlug = await request(app.getHttpServer())
      .get(`/api/v1/places/${placeSlug}`)
      .expect(200);
    expect(bySlug.body.id).toBe(placeId);

    const list = await request(app.getHttpServer())
      .get("/api/v1/places")
      .expect(200);
    expect(list.body.data.some((p: { id: string }) => p.id === placeId)).toBe(
      true,
    );
  });

  it("suspends an approved self-submitted place, hiding it from the public catalog again", async () => {
    const suspended = await request(app.getHttpServer())
      .patch(`/api/v1/admin/places/${placeId}/review-status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "suspended", reason: "Reported as permanently closed" })
      .expect(200);
    expect(suspended.body.reviewStatus).toBe("suspended");
    expect(suspended.body.rejectionReason).toBe(
      "Reported as permanently closed",
    );

    await request(app.getHttpServer())
      .get(`/api/v1/places/${placeSlug}`)
      .expect(404);

    // Reinstate for the rejection test below to start from a clean state.
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/places/${placeId}/review-status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "approved" })
      .expect(200);
  });

  it("rejects a fresh submission with a reason, then auto-resubmits it when the owner edits", async () => {
    const submit = await request(app.getHttpServer())
      .post("/api/v1/places")
      .set("Authorization", `Bearer ${submitterToken}`)
      .send({
        name: "Blue Lake Trail",
        description: "A scenic hiking trail.",
        type: "nature_site",
        categoryId: natureCategory.id,
        countyId: montserrado.id,
        city: "Gbarnga",
        latitude: 6.91,
        longitude: -9.41,
      })
      .expect(201);
    const secondId = submit.body.id;

    const rejected = await request(app.getHttpServer())
      .patch(`/api/v1/admin/places/${secondId}/review-status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "rejected", reason: "Coordinates look off" })
      .expect(200);
    expect(rejected.body.reviewStatus).toBe("rejected");
    expect(rejected.body.rejectionReason).toBe("Coordinates look off");

    const resubmitted = await request(app.getHttpServer())
      .patch(`/api/v1/places/${secondId}`)
      .set("Authorization", `Bearer ${submitterToken}`)
      .send({ latitude: 6.905, longitude: -9.405 })
      .expect(200);
    expect(resubmitted.body.reviewStatus).toBe("submitted_for_review");
    expect(resubmitted.body.rejectionReason).toBeNull();
  });
});
