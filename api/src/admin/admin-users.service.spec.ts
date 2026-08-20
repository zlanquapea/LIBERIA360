import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminUsersService } from "./admin-users.service";
import { User } from "../users/entities/user.entity";
import { TravelerType } from "../users/entities/user.enums";

function fakeQueryBuilder(result: [User[], number]) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

describe("AdminUsersService", () => {
  let service: AdminUsersService;
  let userRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    userRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(AdminUsersService);
  });

  it("paginates and reports total/totalPages from the count", async () => {
    const qb = fakeQueryBuilder([[{ id: "1" } as User], 45]);
    userRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.findAll({ page: 2, limit: 20 });

    expect(qb.skip).toHaveBeenCalledWith(20);
    expect(qb.take).toHaveBeenCalledWith(20);
    expect(result.meta).toEqual({
      total: 45,
      page: 2,
      limit: 20,
      totalPages: 3,
    });
  });

  it("filters by search term against name/email", async () => {
    const qb = fakeQueryBuilder([[], 0]);
    userRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll({ page: 1, limit: 20, search: "kwame" });

    expect(qb.andWhere).toHaveBeenCalledWith(
      "(user.name ILIKE :search OR user.email ILIKE :search)",
      { search: "%kwame%" },
    );
  });

  it("filters by traveler type", async () => {
    const qb = fakeQueryBuilder([[], 0]);
    userRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll({
      page: 1,
      limit: 20,
      travelerType: TravelerType.DIASPORA,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      "user.travelerType = :travelerType",
      {
        travelerType: TravelerType.DIASPORA,
      },
    );
  });

  it("filters to admins only when isAdmin=true", async () => {
    const qb = fakeQueryBuilder([[], 0]);
    userRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll({ page: 1, limit: 20, isAdmin: "true" });

    expect(qb.andWhere).toHaveBeenCalledWith(
      "(user.isAdmin = true OR user.isSuperAdmin = true)",
    );
  });

  it("filters to non-admins only when isAdmin=false", async () => {
    const qb = fakeQueryBuilder([[], 0]);
    userRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll({ page: 1, limit: 20, isAdmin: "false" });

    expect(qb.andWhere).toHaveBeenCalledWith(
      "user.isAdmin = false AND user.isSuperAdmin = false",
    );
  });

  it("applies no admin-status filter when isAdmin is unset", async () => {
    const qb = fakeQueryBuilder([[], 0]);
    userRepo.createQueryBuilder.mockReturnValue(qb);

    await service.findAll({ page: 1, limit: 20 });

    expect(qb.andWhere).not.toHaveBeenCalled();
  });
});
