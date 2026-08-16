import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FreshnessService } from "./freshness.service";
import { PlaceFreshnessReport } from "./entities/place-freshness-report.entity";
import { FreshnessResponse } from "./entities/place-freshness-report.enums";
import { Place } from "../places/entities/place.entity";

describe("FreshnessService", () => {
  let service: FreshnessService;
  let reportRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let placeRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    reportRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => ({ id: "report-1", ...data })),
      create: jest.fn((data) => data),
    };
    placeRepo = { findOne: jest.fn().mockResolvedValue({ id: "place-1" }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FreshnessService,
        {
          provide: getRepositoryToken(PlaceFreshnessReport),
          useValue: reportRepo,
        },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
      ],
    }).compile();

    service = module.get(FreshnessService);
  });

  describe("report", () => {
    it("rejects a report for a place that doesn't exist", async () => {
      placeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.report("user-1", {
          placeId: "place-1",
          response: FreshnessResponse.STILL_HERE,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(reportRepo.save).not.toHaveBeenCalled();
    });

    it("creates a new report when the user hasn't reported on this place before", async () => {
      const result = await service.report("user-1", {
        placeId: "place-1",
        response: FreshnessResponse.NO_LONGER_HERE,
      });
      expect(reportRepo.create).toHaveBeenCalledWith({
        userId: "user-1",
        placeId: "place-1",
        response: FreshnessResponse.NO_LONGER_HERE,
      });
      expect(result.response).toBe(FreshnessResponse.NO_LONGER_HERE);
    });

    it("upserts — a second report from the same user replaces the first instead of adding a row", async () => {
      const existing = {
        id: "existing-report",
        userId: "user-1",
        placeId: "place-1",
        response: FreshnessResponse.STILL_HERE,
      };
      reportRepo.findOne.mockResolvedValue(existing);

      const result = await service.report("user-1", {
        placeId: "place-1",
        response: FreshnessResponse.NO_LONGER_HERE,
      });

      expect(reportRepo.create).not.toHaveBeenCalled();
      expect(reportRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "existing-report",
          response: FreshnessResponse.NO_LONGER_HERE,
        }),
      );
      expect(result.id).toBe("existing-report");
    });
  });

  describe("findMine", () => {
    it("returns null when the user has never reported on this place", async () => {
      reportRepo.findOne.mockResolvedValue(null);
      const result = await service.findMine("user-1", "place-1");
      expect(result).toBeNull();
    });

    it("returns the existing report otherwise", async () => {
      reportRepo.findOne.mockResolvedValue({
        id: "report-1",
        response: FreshnessResponse.STILL_HERE,
      });
      const result = await service.findMine("user-1", "place-1");
      expect(result?.response).toBe(FreshnessResponse.STILL_HERE);
    });
  });
});
