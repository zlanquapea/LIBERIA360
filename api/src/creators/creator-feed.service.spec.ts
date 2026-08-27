import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CreatorFeedService } from "./creator-feed.service";
import { Creator } from "./entities/creator.entity";
import { CreatorFollow } from "./entities/creator-follow.entity";
import { CreatorPost } from "./entities/creator-post.entity";
import {
  CreatorPostComment,
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
