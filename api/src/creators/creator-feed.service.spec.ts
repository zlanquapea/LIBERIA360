import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreatorFeedService } from "./creator-feed.service";
import { Creator } from "./entities/creator.entity";
import { CreatorFollow } from "./entities/creator-follow.entity";
import { CreatorPost } from "./entities/creator-post.entity";
import {
  CreatorPostComment,
  CreatorPostCommentLike,
  CreatorPostLike,
  CreatorPostSave,
} from "./entities/creator-post-interaction.entity";

function queryBuilder() {
  return {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe("CreatorFeedService followed feed", () => {
  let service: CreatorFeedService;
  let followRepo: { find: jest.Mock };
  let postRepo: { createQueryBuilder: jest.Mock };
  let qb: ReturnType<typeof queryBuilder>;

  beforeEach(async () => {
    qb = queryBuilder();
    followRepo = { find: jest.fn().mockResolvedValue([]) };
    postRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorFeedService,
        { provide: getRepositoryToken(Creator), useValue: {} },
        { provide: getRepositoryToken(CreatorPost), useValue: postRepo },
        { provide: getRepositoryToken(CreatorPostLike), useValue: {} },
        { provide: getRepositoryToken(CreatorPostSave), useValue: {} },
        { provide: getRepositoryToken(CreatorPostComment), useValue: {} },
        { provide: getRepositoryToken(CreatorPostCommentLike), useValue: {} },
        { provide: getRepositoryToken(CreatorFollow), useValue: followRepo },
      ],
    }).compile();

    service = module.get(CreatorFeedService);
  });

  it("filters posts to the creators followed by the signed-in viewer", async () => {
    followRepo.find.mockResolvedValue([
      { creatorId: "creator-1" },
      { creatorId: "creator-2" },
    ]);

    await service.findFollowedFeed("viewer-1", { page: 2, limit: 10 });

    expect(followRepo.find).toHaveBeenCalledWith({
      where: { userId: "viewer-1" },
      select: { creatorId: true },
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      "post.creator_id IN (:...creatorIds)",
      { creatorIds: ["creator-1", "creator-2"] },
    );
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
  });

  it("returns an empty page when the viewer follows nobody", async () => {
    const result = await service.findFollowedFeed("viewer-1");

    expect(result).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
    });
    expect(qb.andWhere).toHaveBeenCalledWith("1 = 0", {});
  });
});

// Bug fix (Sep 6, 2026): GET /creators/feed and GET
// /creators/feed/creator/:username were reachable with no guard at all,
// so the controller never had a `user` to pass through as `userId`
// here — every post came back with viewerLiked/viewerSaved hardcoded
// false regardless of the caller's real like/save history. Fixed by
// adding OptionalJwtAuthGuard to those routes (see its own doc comment)
// so a signed-in caller's id reaches here; these tests cover the half
// of that fix that lives in this service — given a userId, does the
// right viewer state come back — the controller/guard wiring itself is
// exercised by creator-feed.controller e2e coverage instead.
describe("CreatorFeedService public feed viewer state", () => {
  let service: CreatorFeedService;
  let creatorRepo: { findOne: jest.Mock };
  let likeRepo: { find: jest.Mock };
  let saveRepo: { find: jest.Mock };
  let postRepo: { createQueryBuilder: jest.Mock };
  let qb: ReturnType<typeof queryBuilder>;

  const post1 = {
    id: "post-1",
    creatorId: "creator-1",
    mediaType: "image",
    mediaUrl: "https://example.com/1.jpg",
    caption: null,
    status: "published",
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    shareCount: 0,
    creator: { id: "creator-1", county: null },
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
  const post2 = { ...post1, id: "post-2" };

  beforeEach(async () => {
    qb = queryBuilder();
    qb.getManyAndCount.mockResolvedValue([[post1, post2], 2]);
    creatorRepo = { findOne: jest.fn() };
    likeRepo = { find: jest.fn().mockResolvedValue([]) };
    saveRepo = { find: jest.fn().mockResolvedValue([]) };
    postRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorFeedService,
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        { provide: getRepositoryToken(CreatorPost), useValue: postRepo },
        { provide: getRepositoryToken(CreatorPostLike), useValue: likeRepo },
        { provide: getRepositoryToken(CreatorPostSave), useValue: saveRepo },
        { provide: getRepositoryToken(CreatorPostComment), useValue: {} },
        { provide: getRepositoryToken(CreatorPostCommentLike), useValue: {} },
        { provide: getRepositoryToken(CreatorFollow), useValue: {} },
      ],
    }).compile();

    service = module.get(CreatorFeedService);
  });

  it("marks a post as viewerLiked/viewerSaved when the caller has an existing like/save row for it", async () => {
    likeRepo.find.mockResolvedValue([{ postId: "post-1" }]);
    saveRepo.find.mockResolvedValue([{ postId: "post-2" }]);

    const result = await service.findPublicFeed({ userId: "viewer-1" });

    expect(likeRepo.find).toHaveBeenCalledWith({
      where: { userId: "viewer-1", postId: expect.anything() },
    });
    expect(result.data.find((p) => p.id === "post-1")).toMatchObject({
      viewerLiked: true,
      viewerSaved: false,
    });
    expect(result.data.find((p) => p.id === "post-2")).toMatchObject({
      viewerLiked: false,
      viewerSaved: true,
    });
  });

  it("skips the like/save lookups entirely for a guest (no userId)", async () => {
    const result = await service.findPublicFeed({});

    expect(likeRepo.find).not.toHaveBeenCalled();
    expect(saveRepo.find).not.toHaveBeenCalled();
    expect(result.data.every((p) => !p.viewerLiked && !p.viewerSaved)).toBe(
      true,
    );
  });

  it("threads the caller's id through findPublicFeedForCreator so a creator's profile feed also reflects viewer state", async () => {
    creatorRepo.findOne.mockResolvedValue({ id: "creator-1" });
    likeRepo.find.mockResolvedValue([{ postId: "post-1" }]);

    const result = await service.findPublicFeedForCreator("alice", {
      userId: "viewer-1",
    });

    expect(likeRepo.find).toHaveBeenCalledWith({
      where: { userId: "viewer-1", postId: expect.anything() },
    });
    expect(result.data.find((p) => p.id === "post-1")?.viewerLiked).toBe(true);
  });
});

// Bug fix (Sep 7, 2026): the Saved page listed a post a viewer had both
// liked and saved with an unfilled heart, because findSaved() hardcoded
// viewerLiked to false regardless of the caller's actual like history —
// unlike the discover feed, which already computed it correctly. Fixed by
// looking up the caller's likes for the saved posts the same way the
// public feed does.
describe("CreatorFeedService findSaved viewer state", () => {
  let service: CreatorFeedService;
  let likeRepo: { find: jest.Mock };
  let saveRepo: { createQueryBuilder: jest.Mock };
  let qb: {
    innerJoinAndSelect: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };

  const savedPost1 = {
    post: {
      id: "post-1",
      creatorId: "creator-1",
      mediaType: "image",
      mediaUrl: "https://example.com/1.jpg",
      caption: null,
      status: "published",
      likeCount: 0,
      commentCount: 0,
      saveCount: 0,
      shareCount: 0,
      creator: { id: "creator-1", county: null },
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
  };
  const savedPost2 = {
    post: { ...savedPost1.post, id: "post-2" },
  };

  beforeEach(async () => {
    qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([savedPost1, savedPost2]),
    };
    likeRepo = { find: jest.fn().mockResolvedValue([]) };
    saveRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorFeedService,
        { provide: getRepositoryToken(Creator), useValue: {} },
        { provide: getRepositoryToken(CreatorPost), useValue: {} },
        { provide: getRepositoryToken(CreatorPostLike), useValue: likeRepo },
        { provide: getRepositoryToken(CreatorPostSave), useValue: saveRepo },
        { provide: getRepositoryToken(CreatorPostComment), useValue: {} },
        { provide: getRepositoryToken(CreatorPostCommentLike), useValue: {} },
        { provide: getRepositoryToken(CreatorFollow), useValue: {} },
      ],
    }).compile();

    service = module.get(CreatorFeedService);
  });

  it("marks a saved post as viewerLiked when the caller also liked it", async () => {
    likeRepo.find.mockResolvedValue([{ postId: "post-1" }]);

    const result = await service.findSaved("viewer-1");

    expect(likeRepo.find).toHaveBeenCalledWith({
      where: { userId: "viewer-1", postId: expect.anything() },
    });
    expect(result.find((p) => p.id === "post-1")).toMatchObject({
      viewerLiked: true,
      viewerSaved: true,
    });
    expect(result.find((p) => p.id === "post-2")).toMatchObject({
      viewerLiked: false,
      viewerSaved: true,
    });
  });

  it("skips the like lookup entirely when there are no saved posts", async () => {
    qb.getMany.mockResolvedValue([]);

    const result = await service.findSaved("viewer-1");

    expect(likeRepo.find).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
