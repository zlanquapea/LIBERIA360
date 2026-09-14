import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UsersService } from "./users.service";
import { User } from "./entities/user.entity";

describe("UsersService", () => {
  let service: UsersService;
  let userRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    userRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe("countActive", () => {
    it("counts users excluding soft-deleted accounts", async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(42),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.countActive();

      expect(result).toBe(42);
      expect(userRepo.createQueryBuilder).toHaveBeenCalledWith("user");
      expect(qb.where).toHaveBeenCalledWith("user.deletedAt IS NULL");
    });
  });
});
