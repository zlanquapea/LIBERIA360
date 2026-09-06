import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DataSource } from "typeorm";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { sessionCookie } from "./helpers/session-cookie";

// Regression coverage for the Sep 6, 2026 bug fix: GET /creators/feed,
// GET /creators/feed/creator/:username, and GET /creators/posts/:id/comments
// had no auth guard at all, so a bare @CurrentUser() on those handlers
// never actually ran the "jwt" strategy — request.user was always
// undefined regardless of a valid session cookie, and every post/comment
// came back with viewerLiked/viewerSaved hardcoded false. The click to
// save/like still worked; it just never *looked* saved/liked again after
// a reload, which is what made "Save" on a creator post look broken.
// OptionalJwtAuthGuard fixes this — these tests exercise the guard,
// controller, and service together end to end, complementing the
// service-level unit tests in creator-feed.service.spec.ts.
describe("Creator feed viewer state (e2e)", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  let ownerToken: string;
  let viewerToken: string;
  let postId: string;
  const creatorUsername = "feed_fix_creator";

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
      "TRUNCATE TABLE creator_post_saves, creator_post_likes, creator_posts, creators, users RESTART IDENTITY CASCADE",
    );

    ownerToken = await registerUser(
      "feed-fix-owner@example.com",
      "Feed Fix Owner",
    );
    viewerToken = await registerUser(
      "feed-fix-viewer@example.com",
      "Feed Fix Viewer",
    );

    await request(app.getHttpServer())
      .post("/api/v1/creators")
      .set("Cookie", ownerToken)
      .send({
        name: "Feed Fix Creator",
        username: creatorUsername,
        category: "photographer",
      })
      .expect(201);

    const postRes = await request(app.getHttpServer())
      .post("/api/v1/creators/me/posts")
      .set("Cookie", ownerToken)
      .send({
        mediaType: "image",
        mediaUrl: "https://example.com/photo.jpg",
        caption: "Sunset over Robertsport",
      })
      .expect(201);
    postId = postRes.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("shows viewerSaved/viewerLiked false for a guest with no session, on both the main feed and a creator's profile feed", async () => {
    const feed = await request(app.getHttpServer())
      .get("/api/v1/creators/feed")
      .expect(200);
    const feedPost = feed.body.data.find(
      (p: { id: string }) => p.id === postId,
    );
    expect(feedPost).toMatchObject({ viewerLiked: false, viewerSaved: false });

    const creatorFeed = await request(app.getHttpServer())
      .get(`/api/v1/creators/feed/creator/${creatorUsername}`)
      .expect(200);
    const creatorFeedPost = creatorFeed.body.data.find(
      (p: { id: string }) => p.id === postId,
    );
    expect(creatorFeedPost).toMatchObject({
      viewerLiked: false,
      viewerSaved: false,
    });
  });

  it("reflects a signed-in viewer's save on the main feed and on the creator's profile feed after a reload", async () => {
    // Before saving: signed in, but hasn't saved anything yet.
    const before = await request(app.getHttpServer())
      .get("/api/v1/creators/feed")
      .set("Cookie", viewerToken)
      .expect(200);
    expect(
      before.body.data.find((p: { id: string }) => p.id === postId),
    ).toMatchObject({ viewerSaved: false });

    await request(app.getHttpServer())
      .post(`/api/v1/creators/posts/${postId}/save`)
      .set("Cookie", viewerToken)
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({ saved: true, saveCount: 1 });
      });

    // This is the exact regression: before the fix, this "reload" always
    // came back viewerSaved: false even though the save above succeeded.
    const afterFeed = await request(app.getHttpServer())
      .get("/api/v1/creators/feed")
      .set("Cookie", viewerToken)
      .expect(200);
    expect(
      afterFeed.body.data.find((p: { id: string }) => p.id === postId),
    ).toMatchObject({ viewerSaved: true });

    const afterCreatorFeed = await request(app.getHttpServer())
      .get(`/api/v1/creators/feed/creator/${creatorUsername}`)
      .set("Cookie", viewerToken)
      .expect(200);
    expect(
      afterCreatorFeed.body.data.find((p: { id: string }) => p.id === postId),
    ).toMatchObject({ viewerSaved: true });

    // A different, guest-eyed request must still see it as not saved —
    // the fix must personalize per-caller, not leak state globally.
    const guestFeed = await request(app.getHttpServer())
      .get("/api/v1/creators/feed")
      .expect(200);
    expect(
      guestFeed.body.data.find((p: { id: string }) => p.id === postId),
    ).toMatchObject({ viewerSaved: false });
  });

  it("reflects a signed-in viewer's comment like on GET .../comments after a reload (same guard fix)", async () => {
    const comment = await request(app.getHttpServer())
      .post(`/api/v1/creators/posts/${postId}/comments`)
      .set("Cookie", ownerToken)
      .send({ body: "Beautiful shot!" })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/creators/posts/${postId}/comments/${comment.body.id}/like`)
      .set("Cookie", viewerToken)
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({ liked: true, likeCount: 1 });
      });

    const comments = await request(app.getHttpServer())
      .get(`/api/v1/creators/posts/${postId}/comments`)
      .set("Cookie", viewerToken)
      .expect(200);
    expect(
      comments.body.find((c: { id: string }) => c.id === comment.body.id),
    ).toMatchObject({ viewerLiked: true });
  });
});
