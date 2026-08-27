import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreatorsService } from "./creators.service";
import { Creator } from "./entities/creator.entity";
import { CreatorPortfolioItem } from "./entities/creator-portfolio-item.entity";
import { CreatorOffering } from "./entities/creator-offering.entity";
import { CreatorFollow } from "./entities/creator-follow.entity";
import { CreatorPortfolioItemType } from "./entities/creator.enums";

const OWNER_ID = "user-1";
const CREATOR = { id: "creator-1", userId: OWNER_ID, username: "creator_a" };

describe("CreatorsService", () => {
  let service: CreatorsService;
  let creatorRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    merge: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let portfolioRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    merge: jest.Mock;
    remove: jest.Mock;
    count: jest.Mock;
  };
  let offeringRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    merge: jest.Mock;
    remove: jest.Mock;
    count: jest.Mock;
  };
  let followRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let creatorQueryBuilder: {
    leftJoinAndSelect: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    andWhere: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    creatorQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    creatorRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(CREATOR),
      save: jest.fn((data) => ({ id: "creator-1", ...data })),
      create: jest.fn((data) => data),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      createQueryBuilder: jest.fn().mockReturnValue(creatorQueryBuilder),
    };
    portfolioRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => ({ id: "item-1", ...data })),
      create: jest.fn((data) => data),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      remove: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    offeringRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => ({ id: "offering-1", ...data })),
      create: jest.fn((data) => data),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      remove: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    followRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        {
          provide: getRepositoryToken(CreatorPortfolioItem),
          useValue: portfolioRepo,
        },
        {
          provide: getRepositoryToken(CreatorOffering),
          useValue: offeringRepo,
        },
        { provide: getRepositoryToken(CreatorFollow), useValue: followRepo },
      ],
    }).compile();

    service = module.get(CreatorsService);
  });

  describe("create", () => {
    it("rejects a second profile for the same user", async () => {
      creatorRepo.findOne.mockResolvedValueOnce(CREATOR); // existingForUser check
      await expect(
        service.create(OWNER_ID, { name: "Dup", username: "dup" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects a taken username", async () => {
      creatorRepo.findOne
        .mockResolvedValueOnce(null) // no existing profile for this user
        .mockResolvedValueOnce(CREATOR); // username taken
      await expect(
        service.create("user-2", { name: "Someone", username: "creator_a" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("update", () => {
    it("404s for a user with no creator profile yet", async () => {
      await expect(
        service.update(OWNER_ID, { name: "New Name" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects renaming to a username someone else already has", async () => {
      creatorRepo.findOne
        .mockResolvedValueOnce(CREATOR) // the caller's own profile
        .mockResolvedValueOnce({ id: "other-creator" }); // taken by someone else
      await expect(
        service.update(OWNER_ID, { username: "someone_else" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    // Regression test: getOwned() below eager-loads `county` with its OLD
    // value (Creator.county is `eager: true`). If that stale relation
    // object is still attached when save() runs, TypeORM's persistence
    // layer prioritizes it over the merged `countyId` scalar and silently
    // keeps the OLD home county — same class of bug as
    // AdminContentService.updatePlace's county/category (see that spec).
    it("clears the stale eager-loaded county relation before saving a reassigned countyId", async () => {
      creatorRepo.findOne.mockResolvedValue({
        ...CREATOR,
        countyId: "county-1",
        county: { id: "county-1", name: "Montserrado" },
      });
      creatorRepo.save = jest.fn((entity) => Promise.resolve(entity));
      await service.update(OWNER_ID, { countyId: "county-2" });
      expect(creatorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ countyId: "county-2", county: undefined }),
      );
    });

    it("leaves the county relation object alone when countyId isn't part of the update", async () => {
      creatorRepo.findOne.mockResolvedValue({
        ...CREATOR,
        countyId: "county-1",
        county: { id: "county-1", name: "Montserrado" },
      });
      creatorRepo.save = jest.fn((entity) => Promise.resolve(entity));
      await service.update(OWNER_ID, { name: "New Name" });
      expect(creatorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Name",
          county: { id: "county-1", name: "Montserrado" },
        }),
      );
    });
  });

  describe("portfolio ownership", () => {
    it("404s adding a portfolio item with no creator profile", async () => {
      await expect(
        service.addPortfolioItem(OWNER_ID, {
          type: CreatorPortfolioItemType.IMAGE,
          url: "https://cdn.example.com/a.jpg",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s editing another creator's portfolio item", async () => {
      creatorRepo.findOne.mockResolvedValue(CREATOR);
      portfolioRepo.findOne.mockResolvedValue({
        id: "item-1",
        creatorId: "someone-elses-creator-id",
      });
      await expect(
        service.updatePortfolioItem(OWNER_ID, "item-1", {
          caption: "Mine now",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("404s editing a portfolio item that doesn't exist", async () => {
      creatorRepo.findOne.mockResolvedValue(CREATOR);
      portfolioRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updatePortfolioItem(OWNER_ID, "missing", {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("assigns the next sortOrder when adding an item", async () => {
      creatorRepo.findOne.mockResolvedValue(CREATOR);
      portfolioRepo.count.mockResolvedValue(2);
      const item = await service.addPortfolioItem(OWNER_ID, {
        type: CreatorPortfolioItemType.IMAGE,
        url: "https://cdn.example.com/a.jpg",
      });
      expect(item.sortOrder).toBe(2);
    });
  });

  describe("offering ownership", () => {
    it("403s editing another creator's offering", async () => {
      creatorRepo.findOne.mockResolvedValue(CREATOR);
      offeringRepo.findOne.mockResolvedValue({
        id: "offering-1",
        creatorId: "someone-elses-creator-id",
      });
      await expect(
        service.updateOffering(OWNER_ID, "offering-1", { title: "Hijacked" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("removes an owned offering", async () => {
      creatorRepo.findOne.mockResolvedValue(CREATOR);
      const offering = { id: "offering-1", creatorId: CREATOR.id };
      offeringRepo.findOne.mockResolvedValue(offering);
      await service.removeOffering(OWNER_ID, "offering-1");
      expect(offeringRepo.remove).toHaveBeenCalledWith(offering);
    });
  });

  describe("findAll", () => {
    it("applies search/category/county/featuredOnly as separate andWhere clauses", async () => {
      await service.findAll({
        search: "ann",
        category: "photographer" as never,
        countyId: "county-1",
        featuredOnly: true,
      });
      expect(creatorQueryBuilder.andWhere).toHaveBeenCalledWith(
        "(creator.name ILIKE :search OR creator.username ILIKE :search)",
        { search: "%ann%" },
      );
      expect(creatorQueryBuilder.andWhere).toHaveBeenCalledWith(
        "creator.category = :category",
        { category: "photographer" },
      );
      expect(creatorQueryBuilder.andWhere).toHaveBeenCalledWith(
        "creator.countyId = :countyId",
        { countyId: "county-1" },
      );
      expect(creatorQueryBuilder.andWhere).toHaveBeenCalledWith(
        "creator.featured = true",
      );
    });
  });

  describe("creator follows", () => {
    it("returns the viewer follow state and current follower count", async () => {
      creatorRepo.findOne.mockResolvedValue({ ...CREATOR, followerCount: 3 });
      followRepo.findOne.mockResolvedValue({ id: "follow-1" });

      await expect(
        service.getFollowState("viewer-1", CREATOR.id),
      ).resolves.toEqual({
        following: true,
        canFollow: true,
        followerCount: 3,
      });
    });

    it("creates a follow and increments the creator count", async () => {
      const creator = { ...CREATOR, userId: "creator-owner", followerCount: 3 };
      creatorRepo.findOne.mockResolvedValue(creator);
      followRepo.findOne.mockResolvedValue(null);

      await expect(
        service.toggleFollow("viewer-1", CREATOR.id),
      ).resolves.toEqual({
        following: true,
        canFollow: true,
        followerCount: 4,
      });
      expect(followRepo.save).toHaveBeenCalledWith({
        creatorId: CREATOR.id,
        userId: "viewer-1",
      });
      expect(creatorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ followerCount: 4 }),
      );
    });

    it("removes an existing follow and decrements the creator count", async () => {
      const creator = { ...CREATOR, userId: "creator-owner", followerCount: 3 };
      const follow = {
        id: "follow-1",
        creatorId: CREATOR.id,
        userId: "viewer-1",
      };
      creatorRepo.findOne.mockResolvedValue(creator);
      followRepo.findOne.mockResolvedValue(follow);

      await expect(
        service.toggleFollow("viewer-1", CREATOR.id),
      ).resolves.toEqual({
        following: false,
        canFollow: true,
        followerCount: 2,
      });
      expect(followRepo.remove).toHaveBeenCalledWith(follow);
      expect(creatorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ followerCount: 2 }),
      );
    });

    it("rejects following your own creator profile", async () => {
      creatorRepo.findOne.mockResolvedValue({ ...CREATOR, followerCount: 3 });

      await expect(
        service.toggleFollow(OWNER_ID, CREATOR.id),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(followRepo.save).not.toHaveBeenCalled();
    });
  });
});
