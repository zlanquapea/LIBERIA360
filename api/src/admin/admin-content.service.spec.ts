import { ConflictException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { QueryFailedError } from "typeorm";
import { AdminContentService } from "./admin-content.service";
import { Place } from "../places/entities/place.entity";
import { PlaceReviewStatus } from "../places/entities/place.enums";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Business } from "../businesses/entities/business.entity";
import { Event } from "../events/entities/event.entity";
import { ReviewsService } from "../reviews/reviews.service";
import { AdminAuditService } from "./admin-audit.service";

// A minimal stand-in for TypeORM's own QueryFailedError, carrying just the
// Postgres error code deleteOrConflict actually branches on.
function fkViolation(): QueryFailedError {
  const err = new QueryFailedError("DELETE ...", [], new Error("fk"));
  (err as QueryFailedError & { code?: string }).code = "23503";
  return err;
}

function fakePlaceQueryBuilder(result: [Place[], number]) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

describe("AdminContentService", () => {
  let service: AdminContentService;
  let placeRepo: {
    exists: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let categoryRepo: {
    exists: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    merge: jest.Mock;
    findOneOrFail: jest.Mock;
    delete: jest.Mock;
  };
  let countyRepo: { exists: jest.Mock; findOne: jest.Mock; delete: jest.Mock };
  let activityRepo: { findOne: jest.Mock; delete: jest.Mock };
  let businessRepo: {
    exists: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let eventRepo: {
    exists: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let reviewsService: { remove: jest.Mock };
  let adminAuditService: { log: jest.Mock };

  beforeEach(async () => {
    placeRepo = {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn().mockResolvedValue({
        id: "place-1",
        name: "CeeCee Beach",
        slug: "ceecee-beach",
      }),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    categoryRepo = {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn(),
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) =>
        Promise.resolve({ id: "category-1", ...entity }),
      ),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      findOneOrFail: jest.fn().mockResolvedValue({
        id: "category-1",
        name: "Beaches",
        slug: "beaches",
      }),
      delete: jest.fn(),
    };
    countyRepo = {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn().mockResolvedValue({
        id: "county-1",
        name: "Montserrado",
        slug: "montserrado",
      }),
      delete: jest.fn(),
    };
    activityRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: "activity-1",
        name: "Sunset kayaking",
        placeId: "place-1",
      }),
      delete: jest.fn(),
    };
    businessRepo = {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn().mockResolvedValue({
        id: "business-1",
        name: "CeeCee Tours",
        linkedPlaceId: "place-1",
      }),
      delete: jest.fn(),
    };
    eventRepo = {
      exists: jest.fn().mockResolvedValue(false),
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
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
        { provide: getRepositoryToken(County), useValue: countyRepo },
        { provide: getRepositoryToken(Activity), useValue: activityRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: ReviewsService, useValue: reviewsService },
        { provide: AdminAuditService, useValue: adminAuditService },
      ],
    }).compile();

    service = module.get(AdminContentService);
  });

  describe("createCategory", () => {
    it("creates a category when the slug is free", async () => {
      const result = await service.createCategory({
        name: "Beaches",
        slug: "beaches",
        icon: "🏖️",
        description: "Coastal spots.",
      });
      expect(categoryRepo.exists).toHaveBeenCalledWith({
        where: { slug: "beaches" },
      });
      expect(categoryRepo.save).toHaveBeenCalled();
      expect(result).toEqual({
        id: "category-1",
        name: "Beaches",
        slug: "beaches",
      });
    });

    it("rejects a slug already in use", async () => {
      categoryRepo.exists.mockResolvedValue(true);
      await expect(
        service.createCategory({ name: "Beaches", slug: "beaches" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(categoryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("updateCategory", () => {
    it("rejects an unknown category", async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateCategory("nonexistent", { name: "New name" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("updates fields on an existing category", async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: "category-1",
        name: "Beaches",
        slug: "beaches",
      });
      await service.updateCategory("category-1", { name: "Beaches & Coast" });
      expect(categoryRepo.merge).toHaveBeenCalled();
      expect(categoryRepo.save).toHaveBeenCalled();
    });

    it("rejects changing the slug to one already in use by another category", async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: "category-1",
        name: "Beaches",
        slug: "beaches",
      });
      categoryRepo.exists.mockResolvedValue(true);
      await expect(
        service.updateCategory("category-1", { slug: "waterfalls-nature" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("deleteCategory", () => {
    it("rejects an unknown category", async () => {
      categoryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteCategory("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(categoryRepo.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting a category still in use by a place", async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: "category-1",
        name: "Beaches",
        slug: "beaches",
      });
      placeRepo.exists.mockResolvedValue(true);
      await expect(
        service.deleteCategory("admin-1", "category-1"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(categoryRepo.delete).not.toHaveBeenCalled();
    });

    it("deletes an unused category and records it in the audit log", async () => {
      categoryRepo.findOne.mockResolvedValue({
        id: "category-1",
        name: "Beaches",
        slug: "beaches",
      });
      await service.deleteCategory("admin-1", "category-1");
      expect(categoryRepo.delete).toHaveBeenCalledWith({ id: "category-1" });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "category.removed",
        "category",
        "category-1",
        { name: "Beaches", slug: "beaches" },
        undefined,
      );
    });
  });

  describe("deletePlace", () => {
    it("rejects an unknown place", async () => {
      placeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deletePlace("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects deleting a place with a linked business", async () => {
      businessRepo.exists.mockResolvedValue(true);
      await expect(
        service.deletePlace("admin-1", "place-1"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(placeRepo.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting a place with events held there", async () => {
      eventRepo.exists.mockResolvedValue(true);
      await expect(
        service.deletePlace("admin-1", "place-1"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(placeRepo.delete).not.toHaveBeenCalled();
    });

    it("deletes a clear place and records it in the audit log", async () => {
      await service.deletePlace("admin-1", "place-1");
      expect(placeRepo.delete).toHaveBeenCalledWith({ id: "place-1" });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "place.removed",
        "place",
        "place-1",
        { name: "CeeCee Beach", slug: "ceecee-beach" },
        undefined,
      );
    });

    it("turns an unanticipated foreign-key violation into a 409, not a 500", async () => {
      placeRepo.delete.mockRejectedValue(fkViolation());
      await expect(
        service.deletePlace("admin-1", "place-1"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(adminAuditService.log).not.toHaveBeenCalled();
    });
  });

  describe("deleteActivity", () => {
    it("rejects an unknown activity", async () => {
      activityRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteActivity("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("deletes the activity and records it in the audit log", async () => {
      await service.deleteActivity("admin-1", "activity-1");
      expect(activityRepo.delete).toHaveBeenCalledWith({ id: "activity-1" });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "activity.removed",
        "activity",
        "activity-1",
        { name: "Sunset kayaking", placeId: "place-1" },
        undefined,
      );
    });
  });

  describe("deleteBusiness", () => {
    it("rejects an unknown business", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteBusiness("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("deletes the business and records it in the audit log", async () => {
      await service.deleteBusiness("admin-1", "business-1");
      expect(businessRepo.delete).toHaveBeenCalledWith({ id: "business-1" });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "business.removed",
        "business",
        "business-1",
        { name: "CeeCee Tours", linkedPlaceId: "place-1" },
        undefined,
      );
    });
  });

  describe("deleteCounty", () => {
    it("rejects an unknown county", async () => {
      countyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteCounty("admin-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects deleting a county that still has places in it", async () => {
      placeRepo.exists.mockResolvedValue(true);
      await expect(
        service.deleteCounty("admin-1", "county-1"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(countyRepo.delete).not.toHaveBeenCalled();
    });

    it("rejects deleting a county that still has events in it", async () => {
      eventRepo.exists.mockResolvedValue(true);
      await expect(
        service.deleteCounty("admin-1", "county-1"),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(countyRepo.delete).not.toHaveBeenCalled();
    });

    it("deletes a clear county and records it in the audit log", async () => {
      await service.deleteCounty("admin-1", "county-1");
      expect(countyRepo.delete).toHaveBeenCalledWith({ id: "county-1" });
      expect(adminAuditService.log).toHaveBeenCalledWith(
        "admin-1",
        "county.removed",
        "county",
        "county-1",
        { name: "Montserrado", slug: "montserrado" },
        undefined,
      );
    });
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

  describe("findPlaces", () => {
    it("joins category, county, and owner, and paginates", async () => {
      const qb = fakePlaceQueryBuilder([[{ id: "place-1" } as Place], 1]);
      placeRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findPlaces({ page: 1, limit: 20 });

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        "place.category",
        "category",
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        "place.county",
        "county",
      );
      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith("place.owner", "owner");
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it("does NOT filter by review status when none is given — every status is visible to admins", async () => {
      const qb = fakePlaceQueryBuilder([[], 0]);
      placeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findPlaces({});

      expect(qb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining("reviewStatus"),
        expect.anything(),
      );
    });

    it("filters by reviewStatus when given", async () => {
      const qb = fakePlaceQueryBuilder([[], 0]);
      placeRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findPlaces({
        reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        "place.reviewStatus = :reviewStatus",
        { reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW },
      );
    });
  });

  describe("findPlaceById", () => {
    it("404s an unknown place", async () => {
      placeRepo.findOne.mockResolvedValue(null);
      await expect(service.findPlaceById("nonexistent")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it("loads the place with category, county, activities, and owner relations", async () => {
      await service.findPlaceById("place-1");
      expect(placeRepo.findOne).toHaveBeenCalledWith({
        where: { id: "place-1" },
        relations: ["category", "county", "activities", "owner"],
      });
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
