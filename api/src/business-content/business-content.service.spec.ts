import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BusinessContentService } from "./business-content.service";
import { BusinessContent } from "./entities/business-content.entity";
import {
  BusinessContentStatus,
  BusinessContentType,
} from "./entities/business-content.enums";
import { Business } from "../businesses/entities/business.entity";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const BUSINESS_ID = "business-1";
const CONTENT_ID = "content-1";

describe("BusinessContentService", () => {
  let service: BusinessContentService;
  let contentRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let businessRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    contentRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: CONTENT_ID, ...data })),
      delete: jest.fn(),
    };
    businessRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: BUSINESS_ID, ownerUserId: OWNER_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessContentService,
        { provide: getRepositoryToken(BusinessContent), useValue: contentRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
      ],
    }).compile();

    service = module.get(BusinessContentService);
  });

  describe("create", () => {
    it("404s an unknown business", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(OWNER_ID, {
          businessId: BUSINESS_ID,
          type: BusinessContentType.OFFER,
          title: "20% off",
          body: "Weekend special.",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s a user who doesn't own the business", async () => {
      await expect(
        service.create(STRANGER_ID, {
          businessId: BUSINESS_ID,
          type: BusinessContentType.OFFER,
          title: "20% off",
          body: "Weekend special.",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(contentRepo.save).not.toHaveBeenCalled();
    });

    it("creates as DRAFT, not live", async () => {
      await service.create(OWNER_ID, {
        businessId: BUSINESS_ID,
        type: BusinessContentType.OFFER,
        title: "20% off",
        body: "Weekend special.",
      });
      expect(contentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: BusinessContentStatus.DRAFT }),
      );
    });
  });

  describe("submit", () => {
    it("404s an unknown content item", async () => {
      contentRepo.findOne.mockResolvedValue(null);
      await expect(service.submit(OWNER_ID, CONTENT_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("403s a user who doesn't own the content's business", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        status: BusinessContentStatus.DRAFT,
        business: { ownerUserId: OWNER_ID },
      });
      await expect(
        service.submit(STRANGER_ID, CONTENT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("moves DRAFT to SUBMITTED_FOR_REVIEW", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        status: BusinessContentStatus.DRAFT,
        business: { ownerUserId: OWNER_ID },
      });
      await service.submit(OWNER_ID, CONTENT_ID);
      expect(contentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BusinessContentStatus.SUBMITTED_FOR_REVIEW,
        }),
      );
    });

    it("moves REJECTED to SUBMITTED_FOR_REVIEW, clearing the reason", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        status: BusinessContentStatus.REJECTED,
        rejectionReason: "Too vague",
        business: { ownerUserId: OWNER_ID },
      });
      await service.submit(OWNER_ID, CONTENT_ID);
      expect(contentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BusinessContentStatus.SUBMITTED_FOR_REVIEW,
          rejectionReason: null,
        }),
      );
    });

    it("is a no-op for an already-APPROVED item", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        status: BusinessContentStatus.APPROVED,
        business: { ownerUserId: OWNER_ID },
      });
      await service.submit(OWNER_ID, CONTENT_ID);
      expect(contentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("resubmits a REJECTED item on edit", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        status: BusinessContentStatus.REJECTED,
        rejectionReason: "Too vague",
        business: { ownerUserId: OWNER_ID },
      });
      await service.update(OWNER_ID, CONTENT_ID, { title: "New title" });
      expect(contentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New title",
          status: BusinessContentStatus.SUBMITTED_FOR_REVIEW,
          rejectionReason: null,
        }),
      );
    });

    it("leaves an APPROVED item's status alone on edit", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        status: BusinessContentStatus.APPROVED,
        business: { ownerUserId: OWNER_ID },
      });
      await service.update(OWNER_ID, CONTENT_ID, { title: "New title" });
      expect(contentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BusinessContentStatus.APPROVED }),
      );
    });
  });

  describe("remove", () => {
    it("403s a user who doesn't own the content's business", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        business: { ownerUserId: OWNER_ID },
      });
      await expect(
        service.remove(STRANGER_ID, CONTENT_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(contentRepo.delete).not.toHaveBeenCalled();
    });

    it("deletes an owned item", async () => {
      contentRepo.findOne.mockResolvedValue({
        id: CONTENT_ID,
        business: { ownerUserId: OWNER_ID },
      });
      await service.remove(OWNER_ID, CONTENT_ID);
      expect(contentRepo.delete).toHaveBeenCalledWith({ id: CONTENT_ID });
    });
  });

  describe("findPublicForBusiness", () => {
    it("only ever queries APPROVED content", async () => {
      await service.findPublicForBusiness(BUSINESS_ID);
      expect(contentRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: BUSINESS_ID,
            status: BusinessContentStatus.APPROVED,
          },
        }),
      );
    });
  });
});
