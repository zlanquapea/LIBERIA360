import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TravelerInfoService } from "./traveler-info.service";
import { TravelerInfoSettings } from "./entities/traveler-info-settings.entity";

const ADMIN_ID = "admin-1";

describe("TravelerInfoService", () => {
  let service: TravelerInfoService;
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TravelerInfoService,
        { provide: getRepositoryToken(TravelerInfoSettings), useValue: repo },
      ],
    }).compile();
    service = module.get(TravelerInfoService);
  });

  describe("get", () => {
    it("materializes the singleton row with every field unset on first read", async () => {
      const settings = await service.get();
      expect(repo.create).toHaveBeenCalledWith({ id: 1 });
      expect(repo.save).toHaveBeenCalled();
      expect(settings).toEqual({ id: 1 });
    });

    it("returns the existing row without creating a second one", async () => {
      repo.findOne.mockResolvedValue({ id: 1, usdToLrdRate: 190 });
      const settings = await service.get();
      expect(settings.usdToLrdRate).toBe(190);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("merges the DTO onto the current row and stamps who changed it", async () => {
      repo.findOne.mockResolvedValue({ id: 1, visaInfo: null });
      const updated = await service.update(
        { visaInfo: "Visa on arrival for most visitors." },
        ADMIN_ID,
      );
      expect(updated).toEqual(
        expect.objectContaining({
          visaInfo: "Visa on arrival for most visitors.",
          updatedByUserId: ADMIN_ID,
        }),
      );
    });
  });
});
