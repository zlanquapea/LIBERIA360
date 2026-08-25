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

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const PLACE_ID = "place-1";

// Every PlacesService test module below needs these even when the test
// itself never touches search — Nest's DI container resolves the full
// constructor at compile() time regardless of which method is exercised.
const emptyCategoryRepo = { find: jest.fn().mockResolvedValue([]) };
const emptyCountyRepo = { find: jest.fn().mockResolvedValue([]) };

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

  beforeEach(async () => {
    placeRepo = {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: PLACE_ID, ...data })),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Category), useValue: emptyCategoryRepo },
        { provide: getRepositoryToken(County), useValue: emptyCountyRepo },
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
});

describe("PlacesService.updateMine", () => {
  let service: PlacesService;
  let placeRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlacesService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Category), useValue: emptyCategoryRepo },
        { provide: getRepositoryToken(County), useValue: emptyCountyRepo },
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
