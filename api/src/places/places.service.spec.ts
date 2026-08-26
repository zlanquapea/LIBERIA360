import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  PlacesService,
  buildPlaceSlug,
  findMatchingCategory,
} from "./places.service";
import { Place } from "./entities/place.entity";
import { PlaceReviewStatus, PlaceType } from "./entities/place.enums";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { BusinessesService } from "../businesses/businesses.service";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const PLACE_ID = "place-1";

// Every PlacesService test module below needs these even when the test
// itself never touches search — Nest's DI container resolves the full
// constructor at compile() time regardless of which method is exercised.
const emptyCategoryRepo = { find: jest.fn().mockResolvedValue([]) };
const emptyCountyRepo = { find: jest.fn().mockResolvedValue([]) };
// Only submitPlace ever calls this — the other describe blocks below just
// need something here so Nest can resolve PlacesService's constructor.
const inertBusinessesService = {
  autoClaimSubmittedPlace: jest.fn().mockResolvedValue({}),
};
// Same reasoning as inertBusinessesService — findMine/findBySlug never
// notify anyone, they just need PlacesService's constructor to resolve.
const inertNotificationsService = { create: jest.fn(), createMany: jest.fn() };
const inertUsersService = { findAdminIds: jest.fn().mockResolvedValue([]) };

describe("buildPlaceSlug", () => {
  it("slugifies the name", async () => {
    const repo = { exists: jest.fn().mockResolvedValue(false) };
    const slug = await buildPlaceSlug(repo as never, "CeeCee Beach!");
    expect(slug).toBe("ceecee-beach");
  });

  it("dedupes against an existing slug by appending -2, -3, ...", async () => {
    const repo = {
      exists: jest
        .fn()
        .mockResolvedValueOnce(true) // "ceecee-beach" taken
        .mockResolvedValueOnce(true) // "ceecee-beach-2" taken
        .mockResolvedValueOnce(false), // "ceecee-beach-3" free
    };
    const slug = await buildPlaceSlug(repo as never, "CeeCee Beach");
    expect(slug).toBe("ceecee-beach-3");
  });

  it("falls back to 'place' for a name with no slugifiable characters", async () => {
    const repo = { exists: jest.fn().mockResolvedValue(false) };
    const slug = await buildPlaceSlug(repo as never, "!!!");
    expect(slug).toBe("place");
  });
});

describe("PlacesService.submitPlace", () => {
  let service: PlacesService;
  let placeRepo: {
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let businessesService: { autoClaimSubmittedPlace: jest.Mock };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };
  let usersService: { findAdminIds: jest.Mock };

  beforeEach(async () => {
    placeRepo = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: PLACE_ID, ...data })),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };
    businessesService = {
      autoClaimSubmittedPlace: jest
        .fn()
        .mockResolvedValue({ id: "business-1" }),
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
        PlacesService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Category), useValue: emptyCategoryRepo },
        { provide: getRepositoryToken(County), useValue: emptyCountyRepo },
        { provide: BusinessesService, useValue: businessesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(PlacesService);
  });

  const dto = {
    name: "Kpatawee Waterfall",
    description: "A scenic waterfall.",
    type: PlaceType.NATURE_SITE,
    categoryId: "category-1",
    countyId: "county-1",
    city: "Gbarnga",
    latitude: 6.9,
    longitude: -9.4,
  };

  it("starts a submission as SUBMITTED_FOR_REVIEW, not live", async () => {
    await service.submitPlace(OWNER_ID, dto);
    expect(placeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
        ownerUserId: OWNER_ID,
        submittedAt: expect.any(Date),
      }),
    );
    expect(placeRepo.save).toHaveBeenCalled();
  });

  it("slugifies the name for the new place", async () => {
    await service.submitPlace(OWNER_ID, dto);
    expect(placeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "kpatawee-waterfall" }),
    );
  });

  it("defaults optional array/nullable fields when omitted", async () => {
    await service.submitPlace(OWNER_ID, dto);
    expect(placeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: [],
        images: [],
        videos: [],
        openingHours: null,
        structuredHours: null,
        contactPhone: null,
        website: null,
      }),
    );
  });

  it("computes structuredHours from parseable opening-hours text", async () => {
    await service.submitPlace(OWNER_ID, {
      ...dto,
      openingHours: "Mon-Fri 9:00-18:00",
    });
    expect(placeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        openingHours: "Mon-Fri 9:00-18:00",
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

  it("leaves structuredHours null for unparseable opening-hours text", async () => {
    await service.submitPlace(OWNER_ID, {
      ...dto,
      openingHours: "Closed Sundays, call ahead for holidays",
    });
    expect(placeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ structuredHours: null }),
    );
  });

  // Product decision (Aug 2026): "when a person creates a place, that
  // account should automatically claim that particular place as the
  // business" — no separate manual claim step for something a submitter
  // just told us they own.
  it("auto-claims the new place as a business owned by the submitter", async () => {
    await service.submitPlace(OWNER_ID, dto);
    expect(businessesService.autoClaimSubmittedPlace).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({ id: PLACE_ID }),
      dto,
    );
  });

  it("still returns the place even if auto-claiming it fails", async () => {
    businessesService.autoClaimSubmittedPlace.mockRejectedValue(
      new Error("boom"),
    );
    await expect(service.submitPlace(OWNER_ID, dto)).resolves.toEqual(
      expect.objectContaining({ id: PLACE_ID }),
    );
  });

  it("notifies every admin that a place is pending review", async () => {
    await service.submitPlace(OWNER_ID, dto);
    expect(usersService.findAdminIds).toHaveBeenCalled();
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      ["admin-1", "admin-2"],
      expect.objectContaining({
        type: "admin.place_pending_review",
        body: expect.stringContaining(dto.name),
      }),
    );
  });
});

describe("PlacesService.updateMine", () => {
  let service: PlacesService;
  let placeRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };
  let usersService: { findAdminIds: jest.Mock };

  beforeEach(async () => {
    placeRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: PLACE_ID,
        ownerUserId: OWNER_ID,
        name: "Kpatawee Waterfall",
        reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      }),
      save: jest.fn((data) => Promise.resolve(data)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findAdminIds: jest.fn().mockResolvedValue(["admin-1"]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Category), useValue: emptyCategoryRepo },
        { provide: getRepositoryToken(County), useValue: emptyCountyRepo },
        { provide: BusinessesService, useValue: inertBusinessesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(PlacesService);
  });

  it("404s an unknown place", async () => {
    placeRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateMine(OWNER_ID, PLACE_ID, { name: "New name" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("403s a user who doesn't own the place", async () => {
    await expect(
      service.updateMine(STRANGER_ID, PLACE_ID, { name: "New name" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(placeRepo.save).not.toHaveBeenCalled();
  });

  it("lets the owner update fields", async () => {
    await service.updateMine(OWNER_ID, PLACE_ID, { name: "New name" });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: "New name" }),
    );
  });

  it("leaves a SUBMITTED_FOR_REVIEW place's status alone on edit", async () => {
    await service.updateMine(OWNER_ID, PLACE_ID, { name: "New name" });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      }),
    );
  });

  it("resubmits a REJECTED place for review on edit, clearing the rejection reason", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      ownerUserId: OWNER_ID,
      name: "Kpatawee Waterfall",
      reviewStatus: PlaceReviewStatus.REJECTED,
      rejectionReason: "Photos are too blurry",
    });
    await service.updateMine(OWNER_ID, PLACE_ID, { description: "Updated." });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
        rejectionReason: null,
        submittedAt: expect.any(Date),
      }),
    );
  });

  it("notifies admins when a rejected place is resubmitted", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      ownerUserId: OWNER_ID,
      name: "Kpatawee Waterfall",
      reviewStatus: PlaceReviewStatus.REJECTED,
      rejectionReason: "Photos are too blurry",
    });
    await service.updateMine(OWNER_ID, PLACE_ID, { description: "Updated." });
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({ type: "admin.place_pending_review" }),
    );
  });

  it("does NOT notify admins for a plain edit that isn't a resubmission", async () => {
    await service.updateMine(OWNER_ID, PLACE_ID, { name: "New name" });
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it("does NOT auto-resubmit a SUSPENDED place on edit", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      ownerUserId: OWNER_ID,
      name: "Kpatawee Waterfall",
      reviewStatus: PlaceReviewStatus.SUSPENDED,
      rejectionReason: "Repeated complaints",
    });
    await service.updateMine(OWNER_ID, PLACE_ID, { description: "Updated." });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: PlaceReviewStatus.SUSPENDED }),
    );
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it("recomputes structuredHours when openingHours is part of the update", async () => {
    await service.updateMine(OWNER_ID, PLACE_ID, {
      openingHours: "Daily 8:00-20:00",
    });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        structuredHours: expect.arrayContaining([
          expect.objectContaining({
            dayOfWeek: 0,
            opens: "08:00",
            closes: "20:00",
          }),
        ]),
      }),
    );
  });

  it("leaves structuredHours untouched when openingHours isn't part of the update", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      ownerUserId: OWNER_ID,
      name: "Kpatawee Waterfall",
      reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      openingHours: "Daily 8:00-20:00",
      structuredHours: [{ dayOfWeek: 0, opens: "08:00", closes: "20:00" }],
    });
    await service.updateMine(OWNER_ID, PLACE_ID, { name: "New name" });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        structuredHours: [{ dayOfWeek: 0, opens: "08:00", closes: "20:00" }],
      }),
    );
  });

  // A submitter needs to be able to fix a category/county picked wrong at
  // submission time — see updateMine's doc comment. These also guard
  // against the TypeORM eager-relation gotcha (clearStaleRelation):
  // category/county are `eager: true`, so findOne() above always returns
  // the place with the OLD relation objects already attached, and saving
  // without clearing them would silently keep writing the old FK.
  it("lets the owner reassign the place's category", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      ownerUserId: OWNER_ID,
      name: "Kpatawee Waterfall",
      reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      categoryId: "old-category",
      category: { id: "old-category", name: "Hospital" },
    });
    await service.updateMine(OWNER_ID, PLACE_ID, {
      categoryId: "new-category",
    });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: "new-category",
        category: undefined,
      }),
    );
  });

  it("lets the owner reassign the place's county", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      ownerUserId: OWNER_ID,
      name: "Kpatawee Waterfall",
      reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      countyId: "old-county",
      county: { id: "old-county", name: "Montserrado" },
    });
    await service.updateMine(OWNER_ID, PLACE_ID, { countyId: "new-county" });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ countyId: "new-county", county: undefined }),
    );
  });

  it("leaves an unset category/county's stale relation alone on an unrelated edit", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      ownerUserId: OWNER_ID,
      name: "Kpatawee Waterfall",
      reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      categoryId: "cat-1",
      category: { id: "cat-1", name: "Waterfall" },
    });
    await service.updateMine(OWNER_ID, PLACE_ID, { name: "New name" });
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ category: { id: "cat-1", name: "Waterfall" } }),
    );
  });
});

describe("PlacesService.findMine", () => {
  it("looks up every place owned by the user regardless of review status", async () => {
    const placeRepo = { find: jest.fn().mockResolvedValue([]) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Category), useValue: emptyCategoryRepo },
        { provide: getRepositoryToken(County), useValue: emptyCountyRepo },
        { provide: BusinessesService, useValue: inertBusinessesService },
        { provide: NotificationsService, useValue: inertNotificationsService },
        { provide: UsersService, useValue: inertUsersService },
      ],
    }).compile();
    const service = module.get(PlacesService);

    await service.findMine(OWNER_ID);
    expect(placeRepo.find).toHaveBeenCalledWith({
      where: { ownerUserId: OWNER_ID },
      relations: ["category", "county"],
      order: { createdAt: "DESC" },
    });
  });
});

describe("PlacesService.findBySlug", () => {
  it("only ever queries for an APPROVED place", async () => {
    const placeRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Category), useValue: emptyCategoryRepo },
        { provide: getRepositoryToken(County), useValue: emptyCountyRepo },
        { provide: BusinessesService, useValue: inertBusinessesService },
        { provide: NotificationsService, useValue: inertNotificationsService },
        { provide: UsersService, useValue: inertUsersService },
      ],
    }).compile();
    const service = module.get(PlacesService);

    await expect(service.findBySlug("kpatawee-falls")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(placeRepo.findOne).toHaveBeenCalledWith({
      where: {
        slug: "kpatawee-falls",
        reviewStatus: PlaceReviewStatus.APPROVED,
      },
      relations: ["category", "county", "activities"],
    });
  });
});

describe("findMatchingCategory", () => {
  const beaches = { id: "cat-1", name: "Beaches", slug: "beaches" };
  const culture = {
    id: "cat-2",
    name: "Culture & Heritage",
    slug: "culture-heritage",
  };
  const categories = [beaches, culture];

  it("matches a plural query against a singular category word (and vice versa)", () => {
    expect(findMatchingCategory(categories, "beach")).toBe(beaches);
    expect(findMatchingCategory(categories, "Beaches")).toBe(beaches);
  });

  it("matches a word from a multi-word category name", () => {
    expect(findMatchingCategory(categories, "culture")).toBe(culture);
    expect(findMatchingCategory(categories, "heritage")).toBe(culture);
  });

  it("matches a known alias for a category", () => {
    expect(findMatchingCategory(categories, "surf")).toBe(beaches);
    expect(findMatchingCategory(categories, "museum")).toBe(culture);
  });

  it("returns null for a multi-word query, even one that would otherwise match", () => {
    expect(findMatchingCategory(categories, "beach vacation")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(findMatchingCategory(categories, "nonexistentxyz")).toBeNull();
  });

  it("returns null for an empty or whitespace-only query", () => {
    expect(findMatchingCategory(categories, "")).toBeNull();
    expect(findMatchingCategory(categories, "   ")).toBeNull();
  });
});
