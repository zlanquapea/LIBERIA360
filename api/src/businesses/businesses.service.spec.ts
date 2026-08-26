import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import {
  BusinessesService,
  mapPlaceTypeToBusinessType,
} from "./businesses.service";
import { Business } from "./entities/business.entity";
import { BusinessReviewStatus, BusinessType } from "./entities/business.enums";
import { Place } from "../places/entities/place.entity";
import { PlaceType } from "../places/entities/place.enums";
import { CreatePlaceSubmissionDto } from "../places/dto/create-place-submission.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const BUSINESS_ID = "business-1";
const PLACE_ID = "place-1";

// DI-satisfying stand-ins for describe blocks that don't exercise the
// admin-notification path — same pattern as places.service.spec.ts.
const inertNotificationsService = { create: jest.fn(), createMany: jest.fn() };
const inertUsersService = { findAdminIds: jest.fn().mockResolvedValue([]) };

describe("BusinessesService.updateMine", () => {
  let service: BusinessesService;
  let businessRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
  };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };
  let usersService: { findAdminIds: jest.Mock };

  beforeEach(async () => {
    businessRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: BUSINESS_ID,
        ownerUserId: OWNER_ID,
        name: "Comfort Lodge",
        images: [],
        reviewStatus: BusinessReviewStatus.APPROVED,
      }),
      findOneOrFail: jest.fn((opts) =>
        Promise.resolve({ id: opts.where.id, ownerUserId: OWNER_ID }),
      ),
      save: jest.fn((data) => data),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    usersService = { findAdminIds: jest.fn().mockResolvedValue(["admin-1"]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Place), useValue: {} },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(BusinessesService);
  });

  it("404s an unknown business", async () => {
    businessRepo.findOne.mockResolvedValue(null);
    await expect(
      service.updateMine(OWNER_ID, BUSINESS_ID, { name: "New name" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("403s a user who doesn't own the business", async () => {
    await expect(
      service.updateMine(STRANGER_ID, BUSINESS_ID, { name: "New name" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(businessRepo.save).not.toHaveBeenCalled();
  });

  it("lets the owner update their listing's photos", async () => {
    const images = ["/uploads/a.jpg", "/uploads/b.jpg"];
    await service.updateMine(OWNER_ID, BUSINESS_ID, { images });
    expect(businessRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ images }),
    );
  });

  it("lets the owner update contact fields without touching images", async () => {
    await service.updateMine(OWNER_ID, BUSINESS_ID, {
      phone: "+231770000000",
    });
    expect(businessRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+231770000000", images: [] }),
    );
  });

  it("leaves an APPROVED listing's reviewStatus alone on edit", async () => {
    await service.updateMine(OWNER_ID, BUSINESS_ID, { name: "New name" });
    expect(businessRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: BusinessReviewStatus.APPROVED }),
    );
  });

  it("resubmits a REJECTED listing for review on edit, clearing the rejection reason", async () => {
    businessRepo.findOne.mockResolvedValue({
      id: BUSINESS_ID,
      ownerUserId: OWNER_ID,
      name: "Comfort Lodge",
      images: [],
      reviewStatus: BusinessReviewStatus.REJECTED,
      rejectionReason: "Missing a real phone number",
    });
    await service.updateMine(OWNER_ID, BUSINESS_ID, { phone: "+231770000000" });
    expect(businessRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: BusinessReviewStatus.SUBMITTED_FOR_REVIEW,
        rejectionReason: null,
      }),
    );
  });

  it("notifies admins when a rejected business is resubmitted", async () => {
    businessRepo.findOne.mockResolvedValue({
      id: BUSINESS_ID,
      ownerUserId: OWNER_ID,
      name: "Comfort Lodge",
      images: [],
      reviewStatus: BusinessReviewStatus.REJECTED,
      rejectionReason: "Missing a real phone number",
    });
    await service.updateMine(OWNER_ID, BUSINESS_ID, { phone: "+231770000000" });
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      ["admin-1"],
      expect.objectContaining({
        type: "admin.business_pending_review",
        body: expect.stringContaining("Comfort Lodge"),
      }),
    );
  });

  it("does NOT notify admins for a plain edit that isn't a resubmission", async () => {
    await service.updateMine(OWNER_ID, BUSINESS_ID, { name: "New name" });
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });

  it("does NOT auto-resubmit a SUSPENDED listing on edit", async () => {
    businessRepo.findOne.mockResolvedValue({
      id: BUSINESS_ID,
      ownerUserId: OWNER_ID,
      name: "Comfort Lodge",
      images: [],
      reviewStatus: BusinessReviewStatus.SUSPENDED,
      rejectionReason: "Repeated fraud reports",
    });
    await service.updateMine(OWNER_ID, BUSINESS_ID, { phone: "+231770000000" });
    expect(businessRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: BusinessReviewStatus.SUSPENDED }),
    );
    expect(notificationsService.createMany).not.toHaveBeenCalled();
  });
});

describe("BusinessesService.claimPlace", () => {
  let service: BusinessesService;
  let businessRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let placeRepo: { findOne: jest.Mock };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };
  let usersService: { findAdminIds: jest.Mock };

  beforeEach(async () => {
    businessRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: BUSINESS_ID, ...data })),
    };
    placeRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: PLACE_ID, name: "CeeCee Beach" }),
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
        BusinessesService,
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(BusinessesService);
  });

  it("404s an unknown place", async () => {
    placeRepo.findOne.mockResolvedValue(null);
    await expect(
      service.claimPlace(OWNER_ID, {
        placeId: PLACE_ID,
        name: "CeeCee Tours",
        type: BusinessType.TOUR_OPERATOR,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("409s a place that already has a business linked", async () => {
    businessRepo.findOne.mockResolvedValue({
      id: "existing",
      ownerUserId: OWNER_ID,
    });
    await expect(
      service.claimPlace(OWNER_ID, {
        placeId: PLACE_ID,
        name: "CeeCee Tours",
        type: BusinessType.TOUR_OPERATOR,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("starts a fresh claim as SUBMITTED_FOR_REVIEW, not live", async () => {
    await service.claimPlace(OWNER_ID, {
      placeId: PLACE_ID,
      name: "CeeCee Tours",
      type: BusinessType.TOUR_OPERATOR,
    });
    expect(businessRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: BusinessReviewStatus.SUBMITTED_FOR_REVIEW,
        submittedAt: expect.any(Date),
      }),
    );
  });

  it("slugifies the name and dedupes on collision", async () => {
    businessRepo.exists
      .mockResolvedValueOnce(true) // "ceecee-tours" taken
      .mockResolvedValueOnce(false); // "ceecee-tours-2" free
    await service.claimPlace(OWNER_ID, {
      placeId: PLACE_ID,
      name: "CeeCee Tours!",
      type: BusinessType.TOUR_OPERATOR,
    });
    expect(businessRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "ceecee-tours-2" }),
    );
  });

  it("notifies every admin that a business is pending review", async () => {
    await service.claimPlace(OWNER_ID, {
      placeId: PLACE_ID,
      name: "CeeCee Tours",
      type: BusinessType.TOUR_OPERATOR,
    });
    expect(notificationsService.createMany).toHaveBeenCalledWith(
      ["admin-1", "admin-2"],
      expect.objectContaining({
        type: "admin.business_pending_review",
        body: expect.stringContaining("CeeCee Tours"),
      }),
    );
  });
});

describe("mapPlaceTypeToBusinessType", () => {
  it("maps each PlaceType to its closest BusinessType", () => {
    expect(mapPlaceTypeToBusinessType(PlaceType.HOTEL)).toBe(
      BusinessType.HOTEL,
    );
    expect(mapPlaceTypeToBusinessType(PlaceType.RESTAURANT)).toBe(
      BusinessType.RESTAURANT,
    );
    expect(mapPlaceTypeToBusinessType(PlaceType.ACTIVITY_PROVIDER)).toBe(
      BusinessType.TOUR_OPERATOR,
    );
    expect(mapPlaceTypeToBusinessType(PlaceType.ATTRACTION)).toBe(
      BusinessType.ATTRACTION,
    );
    expect(mapPlaceTypeToBusinessType(PlaceType.NATURE_SITE)).toBe(
      BusinessType.ATTRACTION,
    );
  });
});

// Product decision (Aug 2026): "when a person creates a place, that account
// should automatically claim that particular place as the business" — see
// PlacesService.submitPlace, which calls this right after saving the place.
describe("BusinessesService.autoClaimSubmittedPlace", () => {
  let service: BusinessesService;
  let businessRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    exists: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let placeRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    businessRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: BUSINESS_ID, ...data })),
    };
    placeRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: PLACE_ID, name: "CeeCee Beach" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: NotificationsService, useValue: inertNotificationsService },
        { provide: UsersService, useValue: inertUsersService },
      ],
    }).compile();

    service = module.get(BusinessesService);
  });

  it("claims the newly-submitted place on the submitter's behalf", async () => {
    const submission = {
      name: "CeeCee Beach",
      type: PlaceType.NATURE_SITE,
      description: "A quiet beach just outside Monrovia.",
      contactPhone: "+231-000-0000",
      whatsapp: "+231-000-0001",
      website: "https://ceecee.example.com",
      images: ["/uploads/ceecee.jpg"],
      openingHours: "Daily 6:00-18:00",
    } as CreatePlaceSubmissionDto;

    await service.autoClaimSubmittedPlace(
      OWNER_ID,
      { id: PLACE_ID } as Place,
      submission,
    );

    expect(businessRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: OWNER_ID,
        linkedPlaceId: PLACE_ID,
        name: "CeeCee Beach",
        type: BusinessType.ATTRACTION,
        phone: "+231-000-0000",
        whatsapp: "+231-000-0001",
        website: "https://ceecee.example.com",
        description: "A quiet beach just outside Monrovia.",
        images: ["/uploads/ceecee.jpg"],
        openingHours: "Daily 6:00-18:00",
        reviewStatus: BusinessReviewStatus.SUBMITTED_FOR_REVIEW,
        submittedAt: expect.any(Date),
      }),
    );
  });
});

describe("BusinessesService public lookups", () => {
  let service: BusinessesService;
  let businessRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    businessRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Place), useValue: {} },
        { provide: NotificationsService, useValue: inertNotificationsService },
        { provide: UsersService, useValue: inertUsersService },
      ],
    }).compile();
    service = module.get(BusinessesService);
  });

  it("findByPlace only ever queries for an APPROVED listing", async () => {
    await service.findByPlace(PLACE_ID);
    expect(businessRepo.findOne).toHaveBeenCalledWith({
      where: {
        linkedPlaceId: PLACE_ID,
        reviewStatus: BusinessReviewStatus.APPROVED,
      },
    });
  });

  it("findBySlug only ever queries for an APPROVED listing", async () => {
    await service.findBySlug("ceecee-tours");
    expect(businessRepo.findOne).toHaveBeenCalledWith({
      where: {
        slug: "ceecee-tours",
        reviewStatus: BusinessReviewStatus.APPROVED,
      },
    });
  });
});
