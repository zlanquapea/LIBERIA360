import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminContentService } from "./admin-content.service";
import { Place } from "../places/entities/place.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Business } from "../businesses/entities/business.entity";
import { Event } from "../events/entities/event.entity";
import { ReviewsService } from "../reviews/reviews.service";
import { AdminAuditService } from "./admin-audit.service";

describe("AdminContentService", () => {
  let service: AdminContentService;
  let eventRepo: { findOne: jest.Mock; delete: jest.Mock };
  let reviewsService: { remove: jest.Mock };
  let adminAuditService: { log: jest.Mock };

  beforeEach(async () => {
    eventRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: "event-1", name: "Test Event" }),
      delete: jest.fn(),
    };
    reviewsService = { remove: jest.fn().mockResolvedValue(undefined) };
    adminAuditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminContentService,
        { provide: getRepositoryToken(Place), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: {} },
        { provide: getRepositoryToken(County), useValue: {} },
        { provide: getRepositoryToken(Activity), useValue: {} },
        { provide: getRepositoryToken(Business), useValue: {} },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: ReviewsService, useValue: reviewsService },
        { provide: AdminAuditService, useValue: adminAuditService },
      ],
    }).compile();

    service = module.get(AdminContentService);
  });

  describe("deleteEvent", () => {
    it("rejects an unknown event", async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteEvent("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(eventRepo.delete).not.toHaveBeenCalled();
      expect(adminAuditService.log).not.toHaveBeenCalled();
    });

    it("deletes the event and records it in the admin audit log", async () => {
      await service.deleteEvent("admin-1", "event-1");
      expect(eventRepo.delete).toHaveBeenCalledWith({ id: "event-1" });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "event.removed",
        "event",
        "event-1",
        { name: "Test Event" },
        undefined,
      );
    });
  });

  describe("deleteReview", () => {
    it("removes the review via ReviewsService and records it in the audit log", async () => {
      await service.deleteReview("admin-1", "review-1");
      expect(reviewsService.remove).toHaveBeenCalledWith("review-1");
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "review.removed",
        "review",
        "review-1",
        undefined,
        undefined,
      );
    });

    it("propagates a NotFoundException from ReviewsService without logging", async () => {
      reviewsService.remove.mockRejectedValue(new NotFoundException());
      await expect(
        service.deleteReview("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(adminAuditService.log).not.toHaveBeenCalled();
    });
  });
});
