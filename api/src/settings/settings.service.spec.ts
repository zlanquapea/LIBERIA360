import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { SettingsService } from "./settings.service";
import { ApplicationSettings } from "./entities/application-settings.entity";

describe("SettingsService", () => {
  let service: SettingsService;
  let repo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(ApplicationSettings), useValue: repo },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  describe("getApplicationSettings", () => {
    it("returns the existing singleton row when one already exists", async () => {
      const existing = { id: 1, freshnessFlagThreshold: 7 };
      repo.findOne.mockResolvedValue(existing);

      const result = await service.getApplicationSettings();

      expect(result).toBe(existing);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("materializes the row with column defaults on the very first read", async () => {
      repo.findOne.mockResolvedValue(null);

      await service.getApplicationSettings();

      expect(repo.create).toHaveBeenCalledWith({ id: 1 });
      expect(repo.save).toHaveBeenCalledWith({ id: 1 });
    });

    it("always reads the same singleton id", async () => {
      repo.findOne.mockResolvedValue(null);
      await service.getApplicationSettings();
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe("updateApplicationSettings", () => {
    it("applies only the fields given, leaving the rest untouched", async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        freshnessFlagThreshold: 3,
        freshnessWindowDays: 90,
        reportFlagThreshold: 3,
        reportWindowDays: 90,
        failedLoginAlertThreshold1h: 5,
        failedLoginAlertThreshold24h: 20,
        updatedByUserId: null,
      });

      const result = await service.updateApplicationSettings(
        { freshnessFlagThreshold: 10 },
        "admin-1",
      );

      expect(result).toMatchObject({
        freshnessFlagThreshold: 10,
        freshnessWindowDays: 90,
        updatedByUserId: "admin-1",
      });
    });

    it("stamps who made the change", async () => {
      repo.findOne.mockResolvedValue({ id: 1, updatedByUserId: null });

      const result = await service.updateApplicationSettings(
        { reportFlagThreshold: 5 },
        "admin-2",
      );

      expect(result.updatedByUserId).toBe("admin-2");
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ updatedByUserId: "admin-2" }),
      );
    });

    it("materializes the row first if this is the very first write", async () => {
      repo.findOne.mockResolvedValue(null);

      await service.updateApplicationSettings(
        { freshnessFlagThreshold: 8 },
        "admin-1",
      );

      // Once to materialize the singleton, once to persist the update.
      expect(repo.save).toHaveBeenCalledTimes(2);
    });
  });
});
