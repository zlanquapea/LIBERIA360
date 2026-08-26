import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdvertisementsService } from "./advertisements.service";
import { Advertisement } from "./entities/advertisement.entity";
import {
  AdvertisementReviewStatus,
  AdvertisementType,
} from "./entities/advertisement.enums";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const AD_ID = "ad-1";

describe("AdvertisementsService", () => {
  let service: AdvertisementsService;
  let adRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };
  let usersService: { findAdminIds: jest.Mock };

  beforeEach(async () => {
    adRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: AD_ID, ...data })),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findAdminIds: jest.fn().mockResolvedValue(["admin-1", "admin-2"]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvertisementsService,
        { provide: getRepositoryToken(Advertisement), useValue: adRepo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(AdvertisementsService);
  });

  describe("create", () => {
    it("submits straight to SUBMITTED_FOR_REVIEW, not DRAFT", async () => {
      await service.create(OWNER_ID, {
        type: AdvertisementType.DIGITAL_PRODUCT,
        title: "My App",
        description: "A great app.",
      });
      expect(adRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUserId: OWNER_ID,
          reviewStatus: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW,
          submittedAt: expect.any(Date),
        }),
      );
    });

    it("notifies every admin that an ad is pending review", async () => {
      await service.create(OWNER_ID, {
        type: AdvertisementType.DIGITAL_PRODUCT,
        title: "My App",
        description: "A great app.",
      });
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        ["admin-1", "admin-2"],
        expect.objectContaining({
          type: "admin.advertisement_pending_review",
          body: expect.stringContaining("My App"),
        }),
      );
    });

    it("defaults optional fields to empty/null", async () => {
      await service.create(OWNER_ID, {
        type: AdvertisementType.BUSINESS,
        title: "My Shop",
        description: "Best shop in town.",
      });
      expect(adRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          images: [],
          priceLabel: null,
          contactPhone: null,
          contactWhatsapp: null,
          contactEmail: null,
          externalLink: null,
        }),
      );
    });
  });

  describe("findMine / findOne", () => {
    it("lists only the caller's own ads, newest first", async () => {
      await service.findMine(OWNER_ID);
      expect(adRepo.find).toHaveBeenCalledWith({
        where: { ownerUserId: OWNER_ID },
        order: { createdAt: "DESC" },
      });
    });

    it("404s an unknown ad", async () => {
      await expect(service.findOne(OWNER_ID, AD_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("403s a user who doesn't own the ad", async () => {
      adRepo.findOne.mockResolvedValue({ id: AD_ID, ownerUserId: OWNER_ID });
      await expect(service.findOne(STRANGER_ID, AD_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("returns the ad for its owner", async () => {
      adRepo.findOne.mockResolvedValue({ id: AD_ID, ownerUserId: OWNER_ID });
      await expect(service.findOne(OWNER_ID, AD_ID)).resolves.toMatchObject({
        id: AD_ID,
        ownerUserId: OWNER_ID,
      });
    });
  });

  describe("update", () => {
    it("resubmits a REJECTED ad for review, clearing the rejection reason", async () => {
      adRepo.findOne.mockResolvedValue({
        id: AD_ID,
        ownerUserId: OWNER_ID,
        reviewStatus: AdvertisementReviewStatus.REJECTED,
        rejectionReason: "Blurry flyer",
      });
      await service.update(OWNER_ID, AD_ID, { title: "Better title" });
      expect(adRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Better title",
          reviewStatus: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW,
          rejectionReason: null,
        }),
      );
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        ["admin-1", "admin-2"],
        expect.objectContaining({ type: "admin.advertisement_pending_review" }),
      );
    });

    it("does NOT auto-resubmit a SUSPENDED ad on edit", async () => {
      adRepo.findOne.mockResolvedValue({
        id: AD_ID,
        ownerUserId: OWNER_ID,
        reviewStatus: AdvertisementReviewStatus.SUSPENDED,
      });
      await service.update(OWNER_ID, AD_ID, { title: "New title" });
      expect(adRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: AdvertisementReviewStatus.SUSPENDED,
        }),
      );
      expect(notificationsService.createMany).not.toHaveBeenCalled();
    });

    it("leaves an APPROVED ad's status alone on a plain edit", async () => {
      adRepo.findOne.mockResolvedValue({
        id: AD_ID,
        ownerUserId: OWNER_ID,
        reviewStatus: AdvertisementReviewStatus.APPROVED,
      });
      await service.update(OWNER_ID, AD_ID, { priceLabel: "$10" });
      expect(adRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: AdvertisementReviewStatus.APPROVED,
        }),
      );
    });

    it("403s a stranger trying to edit someone else's ad", async () => {
      adRepo.findOne.mockResolvedValue({ id: AD_ID, ownerUserId: OWNER_ID });
      await expect(
        service.update(STRANGER_ID, AD_ID, { title: "Hijacked" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(adRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("deletes the caller's own ad", async () => {
      adRepo.findOne.mockResolvedValue({ id: AD_ID, ownerUserId: OWNER_ID });
      await service.remove(OWNER_ID, AD_ID);
      expect(adRepo.delete).toHaveBeenCalledWith({ id: AD_ID });
    });

    it("403s a stranger trying to delete someone else's ad", async () => {
      adRepo.findOne.mockResolvedValue({ id: AD_ID, ownerUserId: OWNER_ID });
      await expect(service.remove(STRANGER_ID, AD_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(adRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("findActive", () => {
    it("queries approved ads only, newest first, capped at the default limit", async () => {
      await service.findActive();
      expect(adRepo.find).toHaveBeenCalledWith({
        where: { reviewStatus: AdvertisementReviewStatus.APPROVED },
        order: { createdAt: "DESC" },
        take: 12,
      });
    });

    it("honors a custom limit", async () => {
      await service.findActive(3);
      expect(adRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3 }),
      );
    });
  });

  describe("findActiveOne", () => {
    it("returns an approved ad by id", async () => {
      adRepo.findOne.mockResolvedValue({
        id: AD_ID,
        reviewStatus: AdvertisementReviewStatus.APPROVED,
      });
      await expect(service.findActiveOne(AD_ID)).resolves.toMatchObject({
        id: AD_ID,
      });
      expect(adRepo.findOne).toHaveBeenCalledWith({
        where: { id: AD_ID, reviewStatus: AdvertisementReviewStatus.APPROVED },
      });
    });

    it("404s an ad that isn't approved (pending, rejected, suspended, or unknown)", async () => {
      adRepo.findOne.mockResolvedValue(null);
      await expect(service.findActiveOne(AD_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
