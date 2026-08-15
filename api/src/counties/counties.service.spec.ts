import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CountiesService } from "./counties.service";
import { County } from "./entities/county.entity";
import { PlacesService } from "../places/places.service";

describe("CountiesService", () => {
  let service: CountiesService;
  let countyRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let placesService: { findAll: jest.Mock };

  beforeEach(async () => {
    countyRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    placesService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountiesService,
        { provide: getRepositoryToken(County), useValue: countyRepo },
        { provide: PlacesService, useValue: placesService },
      ],
    }).compile();

    service = module.get(CountiesService);
  });

  describe("findPlaces", () => {
    it("throws NotFoundException when the county slug does not exist", async () => {
      countyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findPlaces("not-a-county", {} as any),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(placesService.findAll).not.toHaveBeenCalled();
    });

    it("delegates to PlacesService scoped to the county slug when it exists", async () => {
      countyRepo.findOne.mockResolvedValue({ id: "1", slug: "montserrado" });
      const expected = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 1 },
      };
      placesService.findAll.mockResolvedValue(expected);

      const query = { page: 1, limit: 20 } as any;
      const result = await service.findPlaces("montserrado", query);

      expect(placesService.findAll).toHaveBeenCalledWith(query, "montserrado");
      expect(result).toBe(expected);
    });
  });
});
