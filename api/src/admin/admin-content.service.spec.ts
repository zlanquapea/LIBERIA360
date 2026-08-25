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
    find: jest.Mock;
    merge: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
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
    merge: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
    delete: jest.Mock;
  };
  let eventRepo: {
    exists: jest.Mock;
    findOne: jest.Mock;
    merge: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
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
        categoryId: "category-1",
        category: { id: "category-1", name: "Beaches" },
        countyId: "county-1",
        county: { id: "county-1", name: "Montserrado" },
      }),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
      find: jest.fn().mockResolvedValue([]),
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
        ownerUserId: "owner-1",
        owner: { id: "owner-1", name: "Old Owner" },
      }),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
      delete: jest.fn(),
    };
    eventRepo = {
      exists: jest.fn().mockResolvedValue(false),
      findOne: jest.fn().mockResolvedValue({
        id: "event-1",
        name: "Test Event",
        placeId: "place-1",
        place: { id: "place-1", name: "Old Place" },
        countyId: "county-1",
        county: { id: "county-1", name: "Montserrado" },
        locationText: null,
        startDate: new Date("2026-06-01T10:00:00Z"),
        endDate: null,
      }),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      save: jest.fn((entity) => Promise.resolve(entity)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
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

  describe("updatePlace", () => {
    it("rejects an unknown place", async () => {
      placeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updatePlace("nonexistent", { name: "New name" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects a slug already in use by another place", async () => {
      placeRepo.exists.mockResolvedValue(true);
      await expect(
        service.updatePlace("place-1", { slug: "taken-slug" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(placeRepo.save).not.toHaveBeenCalled();
    });

    // Regression test: findOne() above eager-loads `category`/`county` with
    // their OLD values. If that stale relation object is still attached to
    // the entity when save() runs, TypeORM's persistence layer prioritizes
    // it over the merged `countyId`/`categoryId` scalar and silently keeps
    // the OLD county/category no matter what the caller asked for — the
    // super admin panel bug this covers (confirmed against a live Postgres
    // instance before this fix: editing a place's county appeared to
    // succeed but the old value came back on every reload).
    it("clears the stale eager-loaded county relation before saving a reassigned countyId", async () => {
      countyRepo.exists.mockResolvedValue(true);
      await service.updatePlace("place-1", { countyId: "county-2" });
      expect(placeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ countyId: "county-2", county: undefined }),
      );
    });

    it("clears the stale eager-loaded category relation before saving a reassigned categoryId", async () => {
      categoryRepo.exists.mockResolvedValue(true);
      await service.updatePlace("place-1", { categoryId: "category-2" });
      expect(placeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: "category-2",
          category: undefined,
        }),
      );
    });

    it("recomputes structuredHours when openingHours is part of the update", async () => {
      await service.updatePlace("place-1", {
        openingHours: "Mon-Fri 9:00-18:00",
      });
      expect(placeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          structuredHours: expect.arrayContaining([
            expect.objectContaining({
              dayOfWeek: 1,
              opens: "09:00",
              closes: "18:00",
            }),
          ]),
        }),
      );
    });

    it("leaves structuredHours untouched when openingHours isn't part of the update", async () => {
      placeRepo.findOne.mockResolvedValue({
        id: "place-1",
        name: "CeeCee Beach",
        slug: "ceecee-beach",
        categoryId: "category-1",
        category: { id: "category-1", name: "Beaches" },
        countyId: "county-1",
        county: { id: "county-1", name: "Montserrado" },
        openingHours: "Daily 8:00-20:00",
        structuredHours: [{ dayOfWeek: 0, opens: "08:00", closes: "20:00" }],
      });
      await service.updatePlace("place-1", { name: "New name" });
      expect(placeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          structuredHours: [{ dayOfWeek: 0, opens: "08:00", closes: "20:00" }],
        }),
      );
    });

    it("leaves the category/county relation objects alone when their ids aren't part of the update", async () => {
      await service.updatePlace("place-1", { name: "New name" });
      expect(placeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New name",
          county: { id: "county-1", name: "Montserrado" },
          category: { id: "category-1", name: "Beaches" },
        }),
      );
    });
  });

  describe("updateBusiness", () => {
    it("rejects an unknown business", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateBusiness("nonexistent", { name: "New name" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // Same class of bug as updatePlace's county/category above — `owner`
    // is `eager: true` too.
    it("clears the stale eager-loaded owner relation when reassigning ownerUserId", async () => {
      await service.updateBusiness("business-1", { ownerUserId: "owner-2" });
      expect(businessRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: "owner-2", owner: undefined }),
      );
    });

    // ownerUserId: null is how an admin unclaims a listing (see
    // UpdateBusinessAdminDto's doc comment) — `!dto.ownerUserId` would
    // wrongly treat that as "not part of the update" and skip clearing the
    // stale relation, silently keeping the old owner.
    it("clears the stale eager-loaded owner relation when unclaiming (ownerUserId: null)", async () => {
      await service.updateBusiness("business-1", { ownerUserId: null });
      expect(businessRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: null, owner: undefined }),
      );
    });

    it("leaves the owner relation object alone when ownerUserId isn't part of the update", async () => {
      await service.updateBusiness("business-1", { name: "New name" });
      expect(businessRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New name",
          owner: { id: "owner-1", name: "Old Owner" },
        }),
      );
    });
  });

  describe("updateEvent", () => {
    it("rejects an unknown event", async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateEvent("nonexistent", { name: "New name" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    // Same class of bug as updatePlace's county/category above — `place`
    // and `county` are both `eager: true` on Event too.
    it("clears the stale eager-loaded place relation when reassigning placeId", async () => {
      await service.updateEvent("event-1", { placeId: "place-2" });
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ placeId: "place-2", place: undefined }),
      );
    });

    it("clears the stale eager-loaded county relation when reassigning countyId", async () => {
      await service.updateEvent("event-1", { countyId: "county-2" });
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ countyId: "county-2", county: undefined }),
      );
    });

    it("leaves the place/county relation objects alone when their ids aren't part of the update", async () => {
      await service.updateEvent("event-1", { name: "New name" });
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New name",
          place: { id: "place-1", name: "Old Place" },
          county: { id: "county-1", name: "Montserrado" },
        }),
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

  describe("auditPlaceDataQuality", () => {
    function fakePlace(overrides: Partial<Place> = {}): Place {
      return {
        id: "place-1",
        name: "Kpatawee Waterfall",
        slug: "kpatawee-waterfall",
        images: ["photo.jpg"],
        description: "A scenic waterfall popular for a day trip from Monrovia.",
        ...overrides,
      } as Place;
    }

    it("flags nothing for a well-formed place", async () => {
      placeRepo.find.mockResolvedValue([fakePlace()]);
      const result = await service.auditPlaceDataQuality();
      expect(result).toEqual([]);
    });

    it("flags a slug that doesn't match the name — the exact live-site defect this audit exists for", async () => {
      placeRepo.find.mockResolvedValue([
        fakePlace({ name: "Nimba Ecolodge", slug: "kpatawee-waterfall" }),
      ]);
      const result = await service.auditPlaceDataQuality();
      expect(result).toHaveLength(1);
      expect(result[0].issues.some((i) => i.includes("Slug"))).toBe(true);
    });

    it("flags a place with no photos", async () => {
      placeRepo.find.mockResolvedValue([fakePlace({ images: [] })]);
      const result = await service.auditPlaceDataQuality();
      expect(result[0].issues).toContain("No photos");
    });

    it("flags a missing or too-short description", async () => {
      placeRepo.find.mockResolvedValue([fakePlace({ description: "Nice." })]);
      const result = await service.auditPlaceDataQuality();
      expect(result[0].issues).toContain("Description is missing or too short");
    });

    it("flags placeholder-looking description text", async () => {
      placeRepo.find.mockResolvedValue([fakePlace({ description: "TBD" })]);
      const result = await service.auditPlaceDataQuality();
      // Shorter than MIN_DESCRIPTION_LENGTH too, so "too short" wins — the
      // point is it's flagged at all, not which specific message fires.
      expect(result[0].issues.length).toBeGreaterThan(0);
    });

    it("flags placeholder text that's long enough to skip the length check", async () => {
      placeRepo.find.mockResolvedValue([
        fakePlace({ description: "Coming soon" }),
      ]);
      const result = await service.auditPlaceDataQuality();
      expect(result[0].issues).toContain(
        "Description looks like placeholder text",
      );
    });

    it("flags two places sharing the exact same name as a possible duplicate", async () => {
      placeRepo.find.mockResolvedValue([
        fakePlace({ id: "place-1", name: "Sunset Beach" }),
        fakePlace({
          id: "place-2",
          name: "Sunset Beach",
          slug: "sunset-beach-2",
        }),
      ]);
      const result = await service.auditPlaceDataQuality();
      expect(result).toHaveLength(2);
      expect(
        result.every((r) => r.issues.some((i) => i.includes("duplicate"))),
      ).toBe(true);
    });

    it("returns nothing when the catalog is empty", async () => {
      placeRepo.find.mockResolvedValue([]);
      await expect(service.auditPlaceDataQuality()).resolves.toEqual([]);
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
