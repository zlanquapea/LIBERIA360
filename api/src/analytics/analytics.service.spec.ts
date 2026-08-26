import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsEvent } from "./entities/analytics-event.entity";
import { AnalyticsEventType } from "./entities/analytics-event.enums";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Advertisement } from "../advertisements/entities/advertisement.entity";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const AD_ID = "ad-1";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let eventRepo: { create: jest.Mock; save: jest.Mock };
  let placeRepo: { exists: jest.Mock };
  let creatorRepo: { exists: jest.Mock };
  let advertisementRepo: { exists: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    eventRepo = {
      create: jest.fn((data) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };
    placeRepo = { exists: jest.fn().mockResolvedValue(true) };
    creatorRepo = { exists: jest.fn().mockResolvedValue(true) };
    advertisementRepo = {
      exists: jest.fn().mockResolvedValue(true),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(AnalyticsEvent), useValue: eventRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Business), useValue: {} },
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        {
          provide: getRepositoryToken(Advertisement),
          useValue: advertisementRepo,
        },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe("record", () => {
    it("rejects a request with none of placeId/creatorId/advertisementId", async () => {
      await expect(
        service.record({ eventType: AnalyticsEventType.VIEW }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a request with more than one target", async () => {
      await expect(
        service.record({
          placeId: "place-1",
          creatorId: "creator-1",
          eventType: AnalyticsEventType.VIEW,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("404s an unknown advertisement", async () => {
      advertisementRepo.exists.mockResolvedValue(false);
      await expect(
        service.record({
          advertisementId: AD_ID,
          eventType: AnalyticsEventType.VIEW,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("records a view against an existing advertisement", async () => {
      await service.record({
        advertisementId: AD_ID,
        eventType: AnalyticsEventType.CONTACT_CLICK,
      });
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          advertisementId: AD_ID,
          eventType: AnalyticsEventType.CONTACT_CLICK,
        }),
      );
    });
  });

  describe("getAdvertisementAnalytics", () => {
    it("404s an unknown advertisement", async () => {
      await expect(
        service.getAdvertisementAnalytics(OWNER_ID, AD_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s a user who doesn't own the advertisement", async () => {
      advertisementRepo.findOne.mockResolvedValue({
        id: AD_ID,
        ownerUserId: OWNER_ID,
      });
      await expect(
        service.getAdvertisementAnalytics(STRANGER_ID, AD_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns zeroed totals for an ad with no events yet", async () => {
      advertisementRepo.findOne.mockResolvedValue({
        id: AD_ID,
        ownerUserId: OWNER_ID,
      });
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      (
        eventRepo as unknown as { createQueryBuilder: jest.Mock }
      ).createQueryBuilder = jest.fn(() => qb);

      const result = await service.getAdvertisementAnalytics(OWNER_ID, AD_ID);
      expect(result.totals).toEqual({
        view: 0,
        save: 0,
        contact_click: 0,
        booking_request: 0,
      });
      expect(result.byDay).toEqual([]);
    });
  });
});
