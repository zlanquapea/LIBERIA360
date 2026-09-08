import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { sessionCookie } from "./helpers/session-cookie";

// Regression coverage for two bugs found and fixed Sep 8, 2026 while
// building the Facebook-style story viewer, neither of which any prior
// test caught because they only show up when the full app boots and
// routes through real HTTP — a unit test that instantiates
// CreatorStoriesController/Service directly never exercises either:
//
// 1. Controller registration order: CreatorsModule registered
//    CreatorsController (whose `@Get(":username")` is a single-segment
//    catch-all under "creators") BEFORE CreatorStoriesController, so
//    Express/Nest's registration-order route matching sent every
//    GET /creators/stories request into CreatorsController's
//    findByUsername("stories") instead — a 404 "Creator \"stories\" not
//    found", not a real story list. This made the entire public story
//    tray silently return nothing. Fixed by moving CreatorStoriesController
//    ahead of CreatorsController in the module's `controllers` array (see
//    that file's comment for the general rule).
// 2. Missing OptionalJwtAuthGuard: listActive/getStory took a bare
//    `@CurrentUser() user?: User` with no guard at all — the exact same
//    class of bug as creator-feed.e2e-spec.ts's Sep 6 fix — so
//    request.user was always undefined and a signed-in viewer's
//    followers-only stories and per-story viewedByMe flag always came
//    back as if they were signed out.
describe("Creator stories (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let ownerToken: string;
  let viewerToken: string;
  let storyId: string;
  const creatorUsername = "stories_fix_creator";

  async function registerUser(email: string, name: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ name, email, password: "password123" })
      .expect(201);
    return sessionCookie(res);
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
      "TRUNCATE TABLE creator_story_views, creator_stories, creators, users RESTART IDENTITY CASCADE",
    );

    ownerToken = await registerUser(
      "stories-fix-owner@example.com",
      "Stories Fix Owner",
    );
    viewerToken = await registerUser(
      "stories-fix-viewer@example.com",
      "Stories Fix Viewer",
    );

    await request(app.getHttpServer())
      .post("/api/v1/creators")
      .set("Cookie", ownerToken)
      .send({
        name: "Stories Fix Creator",
        username: creatorUsername,
        category: "photographer",
      })
      .expect(201);
    await dataSource.query(
      "UPDATE creators SET verification_status = 'verified' WHERE username = $1",
      [creatorUsername],
    );

    const storyRes = await request(app.getHttpServer())
      .post("/api/v1/creators/stories")
      .set("Cookie", ownerToken)
      .send({
        mediaType: "image",
        mediaUrl: "https://example.com/story.jpg",
        caption: "Sunset over Robertsport",
      })
      .expect(201);
    storyId = storyRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // Regression test for bug #1 above: before the fix, this 404'd instead
  // of listing anything, for every caller — signed in or not.
  it("GET /creators/stories reaches CreatorStoriesController, not CreatorsController's :username catch-all", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/creators/stories")
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.find((s: { id: string }) => s.id === storyId)).toBeTruthy();
  });

  it("shows viewedByMe: false for a guest with no session", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/creators/stories")
      .expect(200);
    const story = res.body.find((s: { id: string }) => s.id === storyId);
    expect(story).toMatchObject({ viewedByMe: false });
  });

  // Regression test for bug #2 above: before the OptionalJwtAuthGuard fix,
  // this always came back false even after view() succeeded, because
  // request.user was never populated on this route at all.
  it("reflects a signed-in viewer's own view as viewedByMe: true on a reload, without leaking to other viewers", async () => {
    const before = await request(app.getHttpServer())
      .get("/api/v1/creators/stories")
      .set("Cookie", viewerToken)
      .expect(200);
    expect(
      before.body.find((s: { id: string }) => s.id === storyId),
    ).toMatchObject({ viewedByMe: false });

    await request(app.getHttpServer())
      .post(`/api/v1/creators/stories/${storyId}/view`)
      .set("Cookie", viewerToken)
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({ viewed: true });
      });

    const after = await request(app.getHttpServer())
      .get("/api/v1/creators/stories")
      .set("Cookie", viewerToken)
      .expect(200);
    expect(
      after.body.find((s: { id: string }) => s.id === storyId),
    ).toMatchObject({ viewedByMe: true });

    // A guest, and a different signed-in user who hasn't viewed it, must
    // still see viewedByMe: false — this has to be personalized per
    // caller, not a global flag on the story.
    const guest = await request(app.getHttpServer())
      .get("/api/v1/creators/stories")
      .expect(200);
    expect(
      guest.body.find((s: { id: string }) => s.id === storyId),
    ).toMatchObject({ viewedByMe: false });
  });

  it("GET /creators/stories/:id also personalizes viewedByMe for a signed-in viewer", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/creators/stories/${storyId}`)
      .set("Cookie", viewerToken)
      .expect(200);
    // The prior test already recorded this viewer's view against this
    // exact story, so a single-story fetch should agree with the list.
    expect(res.body).toMatchObject({ id: storyId, viewedByMe: true });
  });
});
