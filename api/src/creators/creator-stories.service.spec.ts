import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreatorStoriesService } from "./creator-stories.service";
import { Creator } from "./entities/creator.entity";
import { CreatorVerificationStatus } from "./entities/creator.enums";
import {
  CreatorStory,
  CreatorStoryComment,
  CreatorStoryMediaType,
  CreatorStoryReaction,
  CreatorStoryReport,
  CreatorStoryView,
  CreatorStoryVisibility,
  STORY_VISIBILITY_HOURS,
} from "./entities/creator-story.entity";
import { CreatorFollow } from "./entities/creator-follow.entity";
import { User } from "../users/entities/user.entity";

const CREATOR = {
  id: "creator-1",
  userId: "owner-1",
  verificationStatus: CreatorVerificationStatus.VERIFIED,
};

describe("CreatorStoriesService", () => {
  let service: CreatorStoriesService;
  let creatorRepo: { findOne: jest.Mock };
  let storyRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    increment: jest.Mock;
    decrement: jest.Mock;
  };
  let viewRepo: { find: jest.Mock; insert: jest.Mock; create: jest.Mock };
  let reportRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let reactionRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
    find: jest.Mock;
  };
  let commentRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let userRepo: { findBy: jest.Mock; findOneBy: jest.Mock };
  let followRepo: { find: jest.Mock; findOne: jest.Mock };
  let storyQueryBuilder: {
    innerJoinAndSelect: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };

  function makeStory(overrides: Partial<CreatorStory> = {}): CreatorStory {
    const publishedAt = overrides.publishedAt ?? new Date();
    return {
      id: "story-1",
      creatorId: CREATOR.id,
      creator: {
        id: CREATOR.id,
        name: "Creator One",
        username: "creator_one",
        profileImage: null,
        verificationStatus: CreatorVerificationStatus.VERIFIED,
      } as unknown as Creator,
      mediaType: CreatorStoryMediaType.IMAGE,
      mediaUrl: "https://example.com/photo.jpg",
      caption: null,
      status: "approved" as CreatorStory["status"],
      visibility: CreatorStoryVisibility.PUBLIC,
      placeId: null,
      eventId: null,
      tripId: null,
      creatorProfileId: null,
      viewCount: 0,
      reactionCount: 0,
      commentCount: 0,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      publishedAt,
      expiresAt: new Date(publishedAt.getTime() + 60 * 60 * 1000),
      ...overrides,
    } as CreatorStory;
  }

  beforeEach(async () => {
    storyQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };
    creatorRepo = { findOne: jest.fn() };
    storyRepo = {
      createQueryBuilder: jest.fn(() => storyQueryBuilder),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn((entity) =>
        Promise.resolve({ id: "story-new", ...entity }),
      ),
      create: jest.fn((entity) => entity),
      increment: jest.fn(),
      decrement: jest.fn(),
    };
    viewRepo = {
      find: jest.fn().mockResolvedValue([]),
      insert: jest.fn(),
      create: jest.fn((entity) => entity),
    };
    reportRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((entity) => entity),
    };
    reactionRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((entity) => entity),
      remove: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    commentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn((entity) =>
        Promise.resolve({ id: "comment-1", createdAt: new Date(), ...entity }),
      ),
      create: jest.fn((entity) => entity),
      remove: jest.fn(),
    };
    userRepo = {
      findBy: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
    };
    followRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorStoriesService,
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        { provide: getRepositoryToken(CreatorStory), useValue: storyRepo },
        { provide: getRepositoryToken(CreatorStoryView), useValue: viewRepo },
        {
          provide: getRepositoryToken(CreatorStoryReport),
          useValue: reportRepo,
        },
        {
          provide: getRepositoryToken(CreatorStoryReaction),
          useValue: reactionRepo,
        },
        {
          provide: getRepositoryToken(CreatorStoryComment),
          useValue: commentRepo,
        },
        { provide: getRepositoryToken(CreatorFollow), useValue: followRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(CreatorStoriesService);
  });

  describe("create", () => {
    it("sets expiresAt exactly STORY_VISIBILITY_HOURS (24h) after publishedAt", async () => {
      creatorRepo.findOne.mockResolvedValue(CREATOR);
      const saved = makeStory();
      storyRepo.findOneOrFail.mockResolvedValue(saved);

      await service.create(CREATOR.userId, {
        mediaType: CreatorStoryMediaType.IMAGE,
        mediaUrl: "https://example.com/a.jpg",
      });

      const created = storyRepo.create.mock.calls[0][0];
      expect(created.publishedAt).toBeInstanceOf(Date);
      expect(created.expiresAt.getTime() - created.publishedAt.getTime()).toBe(
        STORY_VISIBILITY_HOURS * 60 * 60 * 1000,
      );
      expect(STORY_VISIBILITY_HOURS).toBe(24);
    });

    it("rejects an unverified creator", async () => {
      creatorRepo.findOne.mockResolvedValue({
        ...CREATOR,
        verificationStatus: CreatorVerificationStatus.UNVERIFIED,
      });
      await expect(
        service.create(CREATOR.userId, {
          mediaType: CreatorStoryMediaType.IMAGE,
          mediaUrl: "https://example.com/a.jpg",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("listActive", () => {
    it("marks viewedByMe true only for stories this exact viewer has already seen", async () => {
      const seen = makeStory({ id: "story-seen" });
      const unseen = makeStory({ id: "story-unseen" });
      storyQueryBuilder.getMany.mockResolvedValue([seen, unseen]);
      viewRepo.find.mockResolvedValue([
        { storyId: "story-seen", viewerUserId: "viewer-1" },
      ]);

      const result = await service.listActive("viewer-1");

      expect(result.find((s) => s.id === "story-seen")?.viewedByMe).toBe(true);
      expect(result.find((s) => s.id === "story-unseen")?.viewedByMe).toBe(
        false,
      );
    });

    it("never marks anything viewed for an anonymous (signed-out) caller", async () => {
      storyQueryBuilder.getMany.mockResolvedValue([makeStory()]);

      const result = await service.listActive(undefined);

      expect(result[0].viewedByMe).toBe(false);
      // No point querying views at all with nobody to attribute them to.
      expect(viewRepo.find).not.toHaveBeenCalled();
    });

    it("skips the views lookup entirely when there are no active stories", async () => {
      storyQueryBuilder.getMany.mockResolvedValue([]);
      await service.listActive("viewer-1");
      expect(viewRepo.find).not.toHaveBeenCalled();
    });
  });

  describe("recordView", () => {
    it("does not let a creator's own view count against their own story", async () => {
      const story = makeStory({
        creator: { userId: CREATOR.userId } as unknown as Creator,
      });
      storyRepo.findOne.mockResolvedValue(story);

      const result = await service.recordView(story.id, CREATOR.userId);

      expect(result.viewed).toBe(false);
      expect(viewRepo.insert).not.toHaveBeenCalled();
    });

    it("404s once the story has expired, even if its status row hasn't caught up yet", async () => {
      const expired = makeStory({ expiresAt: new Date(Date.now() - 1000) });
      storyRepo.findOne.mockResolvedValue(expired);

      await expect(service.recordView(expired.id, "viewer-1")).rejects.toThrow(
        "Story not found",
      );
    });
  });

  describe("toggleReaction", () => {
    it("adds a reaction and increments reactionCount on a first tap", async () => {
      const story = makeStory({ reactionCount: 2 });
      storyRepo.findOne.mockResolvedValue(story);
      reactionRepo.findOne.mockResolvedValue(null);

      const result = await service.toggleReaction("viewer-1", story.id, {
        emoji: "🔥",
      });

      expect(reactionRepo.save).toHaveBeenCalled();
      expect(storyRepo.increment).toHaveBeenCalledWith(
        { id: story.id },
        "reactionCount",
        1,
      );
      expect(result).toEqual({ reactionCount: 3, myReaction: "🔥" });
    });

    it("removes the reaction (toggle off) when tapping the same emoji again", async () => {
      const story = makeStory({ reactionCount: 3 });
      storyRepo.findOne.mockResolvedValue(story);
      reactionRepo.findOne.mockResolvedValue({
        id: "reaction-1",
        storyId: story.id,
        userId: "viewer-1",
        emoji: "🔥",
      });

      const result = await service.toggleReaction("viewer-1", story.id, {
        emoji: "🔥",
      });

      expect(reactionRepo.remove).toHaveBeenCalled();
      expect(result).toEqual({ reactionCount: 2, myReaction: null });
    });

    it("swaps the emoji without changing reactionCount when picking a different one", async () => {
      const story = makeStory({ reactionCount: 5 });
      storyRepo.findOne.mockResolvedValue(story);
      const existing = {
        id: "reaction-1",
        storyId: story.id,
        userId: "viewer-1",
        emoji: "🔥",
      };
      reactionRepo.findOne.mockResolvedValue(existing);

      const result = await service.toggleReaction("viewer-1", story.id, {
        emoji: "😮",
      });

      expect(reactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ emoji: "😮" }),
      );
      expect(storyRepo.increment).not.toHaveBeenCalled();
      expect(result).toEqual({ reactionCount: 5, myReaction: "😮" });
    });

    it("404s reacting to a story a non-follower can't see", async () => {
      const story = makeStory({ visibility: CreatorStoryVisibility.FOLLOWERS });
      storyRepo.findOne.mockResolvedValue(story);
      followRepo.findOne.mockResolvedValue(null);

      await expect(
        service.toggleReaction("viewer-1", story.id, { emoji: "🔥" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("comments", () => {
    it("lists comments with a minimal public author (no email/PII)", async () => {
      const story = makeStory();
      storyRepo.findOne.mockResolvedValue(story);
      commentRepo.find.mockResolvedValue([
        {
          id: "c1",
          storyId: story.id,
          userId: "author-1",
          body: "Nice!",
          createdAt: new Date(),
        },
      ]);
      userRepo.findBy.mockResolvedValue([
        { id: "author-1", name: "Ama", email: "ama@example.com" },
      ]);

      const result = await service.listComments(story.id, "viewer-1");

      expect(result[0].user).toEqual({ id: "author-1", name: "Ama" });
      expect(result[0].user).not.toHaveProperty("email");
    });

    it("adds a comment and increments commentCount", async () => {
      const story = makeStory({ commentCount: 1 });
      storyRepo.findOne.mockResolvedValue(story);
      userRepo.findOneBy.mockResolvedValue({ id: "viewer-1", name: "Kojo" });

      const comment = await service.addComment("viewer-1", story.id, {
        body: "Love this!",
      });

      expect(storyRepo.increment).toHaveBeenCalledWith(
        { id: story.id },
        "commentCount",
        1,
      );
      expect(comment.body).toBe("Love this!");
      expect(comment.user).toEqual({ id: "viewer-1", name: "Kojo" });
    });

    it("rejects a blank comment", async () => {
      const story = makeStory();
      storyRepo.findOne.mockResolvedValue(story);

      await expect(
        service.addComment("viewer-1", story.id, { body: "   " }),
      ).rejects.toThrow("Comment cannot be empty");
    });

    it("lets the comment's own author remove it", async () => {
      const story = makeStory();
      commentRepo.findOne.mockResolvedValue({
        id: "c1",
        storyId: story.id,
        userId: "author-1",
        body: "hi",
      });
      storyRepo.findOne.mockResolvedValue(story);

      await service.removeComment("author-1", story.id, "c1");

      expect(commentRepo.remove).toHaveBeenCalled();
      expect(storyRepo.decrement).toHaveBeenCalledWith(
        { id: story.id },
        "commentCount",
        1,
      );
    });

    it("lets the story owner remove someone else's comment", async () => {
      const story = makeStory({
        creator: { userId: CREATOR.userId } as unknown as Creator,
      });
      commentRepo.findOne.mockResolvedValue({
        id: "c1",
        storyId: story.id,
        userId: "someone-else",
        body: "hi",
      });
      storyRepo.findOne.mockResolvedValue(story);

      await service.removeComment(CREATOR.userId, story.id, "c1");

      expect(commentRepo.remove).toHaveBeenCalled();
    });

    it("forbids a random viewer from removing someone else's comment", async () => {
      const story = makeStory();
      commentRepo.findOne.mockResolvedValue({
        id: "c1",
        storyId: story.id,
        userId: "someone-else",
        body: "hi",
      });
      storyRepo.findOne.mockResolvedValue(story);

      await expect(
        service.removeComment("random-viewer", story.id, "c1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(commentRepo.remove).not.toHaveBeenCalled();
    });
  });
});
