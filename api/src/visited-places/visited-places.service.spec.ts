import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { VisitedPlacesService } from "./visited-places.service";
import { VisitedPlace } from "./entities/visited-place.entity";
import { Place } from "../places/entities/place.entity";
import { County } from "../counties/entities/county.entity";
import { User } from "../users/entities/user.entity";

const USER_ID = "user-1";

describe("VisitedPlacesService", () => {
  let service: VisitedPlacesService;
  let visitedPlaceRepo: {
    upsert: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let placeRepo: { findOne: jest.Mock };
  let countyRepo: { count: jest.Mock };
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    visitedPlaceRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn().mockResolvedValue([]),
    };
    placeRepo = { findOne: jest.fn().mockResolvedValue({ id: "place-1" }) };
    countyRepo = { count: jest.fn().mockResolvedValue(15) };
    userRepo = { findOne: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitedPlacesService,
        {
          provide: getRepositoryToken(VisitedPlace),
          useValue: visitedPlaceRepo,
        },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(County), useValue: countyRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(VisitedPlacesService);
  });

  describe("markVisited / unmarkVisited", () => {
    it("404s marking a place that doesn't exist", async () => {
      placeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.markVisited(USER_ID, "no-such-place"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(visitedPlaceRepo.upsert).not.toHaveBeenCalled();
    });

    it("upserts on the (userId, placeId) unique constraint, idempotently", async () => {
      await service.markVisited(USER_ID, "place-1");
      expect(visitedPlaceRepo.upsert).toHaveBeenCalledWith(
        { userId: USER_ID, placeId: "place-1" },
        ["userId", "placeId"],
      );
    });

    it("unmarking something never marked is a no-op, not an error", async () => {
      await expect(
        service.unmarkVisited(USER_ID, "place-1"),
      ).resolves.toBeUndefined();
    });
  });

  describe("getExplorerProgress", () => {
    it("computes visitedPlacesCount, distinct counties, and badges purely from the counts", async () => {
      const countyA = { id: "co-1", name: "Montserrado" };
      const countyB = { id: "co-2", name: "Nimba" };
      visitedPlaceRepo.find.mockResolvedValue([
        { place: { county: countyA } },
        { place: { county: countyA } },
        { place: { county: countyB } },
      ]);
      countyRepo.count.mockResolvedValue(15);

      const progress = await service.getExplorerProgress(USER_ID);

      expect(progress.visitedPlacesCount).toBe(3);
      expect(progress.countiesVisited.map((c) => c.name)).toEqual([
        "Montserrado",
        "Nimba",
      ]);
      expect(progress.totalCounties).toBe(15);
      expect(
        progress.badges.find((b) => b.id === "first_steps")?.achieved,
      ).toBe(true);
      expect(progress.badges.find((b) => b.id === "explorer")?.achieved).toBe(
        false,
      );
      expect(
        progress.badges.find((b) => b.id === "liberia_completionist")?.achieved,
      ).toBe(false);
    });

    it("awards the completionist badge once every county has a visited place", async () => {
      const counties = Array.from({ length: 3 }, (_, i) => ({
        id: `co-${i}`,
        name: `County ${i}`,
      }));
      visitedPlaceRepo.find.mockResolvedValue(
        counties.map((county) => ({ place: { county } })),
      );
      countyRepo.count.mockResolvedValue(3);

      const progress = await service.getExplorerProgress(USER_ID);
      expect(
        progress.badges.find((b) => b.id === "liberia_completionist")?.achieved,
      ).toBe(true);
    });

    it("skips a visited row whose place has been hard-deleted out from under it", async () => {
      visitedPlaceRepo.find.mockResolvedValue([
        { place: { county: { id: "co-1", name: "Montserrado" } } },
        { place: null },
      ]);
      const progress = await service.getExplorerProgress(USER_ID);
      expect(progress.visitedPlacesCount).toBe(1);
    });
  });

  describe("getPublicProfile", () => {
    it("404s for an account that hasn't opted in", async () => {
      userRepo.findOne.mockResolvedValue({
        name: "Ada",
        explorerProfilePublic: false,
      });
      await expect(service.getPublicProfile(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("404s the same way for an unknown user id (never confirms which)", async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getPublicProfile(USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("returns name/profileImage/progress for an opted-in account", async () => {
      userRepo.findOne.mockResolvedValue({
        name: "Ada",
        profileImage: "https://example.com/ada.jpg",
        explorerProfilePublic: true,
      });
      const profile = await service.getPublicProfile(USER_ID);
      expect(profile.name).toBe("Ada");
      expect(profile.profileImage).toBe("https://example.com/ada.jpg");
      expect(profile.progress.totalCounties).toBe(15);
    });
  });
});
