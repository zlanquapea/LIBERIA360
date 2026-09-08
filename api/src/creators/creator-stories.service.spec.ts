import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreatorStoriesService } from "./creator-stories.service";
import { Creator } from "./entities/creator.entity";
import { CreatorVerificationStatus } from "./entities/creator.enums";
import {
  CreatorStory,
  CreatorStoryMediaType,
  CreatorStoryReport,
  CreatorStoryView,
  CreatorStoryVisibility,
  STORY_VISIBILITY_HOURS,
} from "./entities/creator-story.entity";
import { CreatorFollow } from "./entities/creator-follow.entity";

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
  };
  let viewRepo: { find: jest.Mock; insert: jest.Mock; create: jest.Mock };
  let reportRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
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
        { provide: getRepositoryToken(CreatorFollow), useValue: followRepo },
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
});
