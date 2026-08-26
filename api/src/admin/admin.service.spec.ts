import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AdminService } from "./admin.service";
import { Place } from "../places/entities/place.entity";
import { PlaceReviewStatus } from "../places/entities/place.enums";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { Review } from "../reviews/entities/review.entity";
import { PlaceFreshnessReport } from "../freshness/entities/place-freshness-report.entity";
import { Event } from "../events/entities/event.entity";
import { ContentReport } from "../reports/entities/content-report.entity";
import { User } from "../users/entities/user.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BusinessContent } from "../business-content/entities/business-content.entity";
import { AdminAuditService } from "./admin-audit.service";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { Advertisement } from "../advertisements/entities/advertisement.entity";
import { AdvertisementReviewStatus } from "../advertisements/entities/advertisement.enums";

const ADMIN_ID = "admin-1";
const PLACE_ID = "place-1";
const AD_ID = "ad-1";

// DI-satisfying stand-in for describe blocks that don't exercise the
// submitter-notification path.
const inertNotificationsService = { create: jest.fn(), createMany: jest.fn() };

// The defaults ApplicationSettings' columns used to be — matches what
// the hardcoded constants this replaced used to be, so these tests
// exercise exactly the same thresholds they always did.
const DEFAULT_APPLICATION_SETTINGS = {
  freshnessFlagThreshold: 3,
  freshnessWindowDays: 90,
  reportFlagThreshold: 3,
  reportWindowDays: 90,
  failedLoginAlertThreshold1h: 5,
  failedLoginAlertThreshold24h: 20,
};

function fakeSettingsService(
  overrides: Partial<typeof DEFAULT_APPLICATION_SETTINGS> = {},
) {
  return {
    getApplicationSettings: jest
      .fn()
      .mockResolvedValue({ ...DEFAULT_APPLICATION_SETTINGS, ...overrides }),
  };
}

describe("AdminService.setPlaceReviewStatus", () => {
  let service: AdminService;
  let placeRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let adminAuditService: { log: jest.Mock };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };

  beforeEach(async () => {
    placeRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: PLACE_ID,
        name: "Kpatawee Waterfall",
        ownerUserId: "owner-1",
        reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      }),
      save: jest.fn((data) => Promise.resolve(data)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };
    adminAuditService = { log: jest.fn() };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Business), useValue: {} },
        { provide: getRepositoryToken(Creator), useValue: {} },
        { provide: getRepositoryToken(Review), useValue: {} },
        { provide: getRepositoryToken(PlaceFreshnessReport), useValue: {} },
        { provide: getRepositoryToken(Event), useValue: {} },
        { provide: getRepositoryToken(ContentReport), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Booking), useValue: {} },
        { provide: getRepositoryToken(BusinessContent), useValue: {} },
        { provide: getRepositoryToken(Advertisement), useValue: {} },
        { provide: AdminAuditService, useValue: adminAuditService },
        { provide: SettingsService, useValue: fakeSettingsService() },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it("404s an unknown place", async () => {
    placeRepo.findOne.mockResolvedValue(null);
    await expect(
      service.setPlaceReviewStatus(
        ADMIN_ID,
        PLACE_ID,
        PlaceReviewStatus.APPROVED,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("approves a pending place, clearing any rejection reason", async () => {
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.APPROVED,
    );
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: PlaceReviewStatus.APPROVED,
        rejectionReason: null,
        reviewedByUserId: ADMIN_ID,
        reviewedAt: expect.any(Date),
      }),
    );
  });

  it("rejects a place with a reason", async () => {
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.REJECTED,
      "Photos are too blurry",
    );
    expect(placeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: PlaceReviewStatus.REJECTED,
        rejectionReason: "Photos are too blurry",
      }),
    );
  });

  it("records the transition in the admin audit log", async () => {
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.APPROVED,
    );
    expect(adminAuditService.log).toHaveBeenCalledWith(
      ADMIN_ID,
      "place.review_status_changed",
      "place",
      PLACE_ID,
      {
        from: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
        to: PlaceReviewStatus.APPROVED,
        reason: null,
      },
      undefined,
    );
  });

  it("reloads the saved place with category/county/owner relations", async () => {
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.APPROVED,
    );
    expect(placeRepo.findOneOrFail).toHaveBeenCalledWith({
      where: { id: PLACE_ID },
      relations: ["category", "county", "owner"],
    });
  });

  it("notifies the submitter when their place is approved", async () => {
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.APPROVED,
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        type: "place.review_decided",
        body: expect.stringContaining("Kpatawee Waterfall"),
      }),
    );
  });

  it("notifies the submitter with the reason when their place is rejected", async () => {
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.REJECTED,
      "Photos are too blurry",
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        type: "place.review_decided",
        body: expect.stringContaining("Photos are too blurry"),
      }),
    );
  });

  it("does NOT notify anyone for a still-pending transition like UNDER_REVIEW", async () => {
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.UNDER_REVIEW,
    );
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it("skips notifying when the place has no owner on file", async () => {
    placeRepo.findOne.mockResolvedValue({
      id: PLACE_ID,
      name: "Kpatawee Waterfall",
      ownerUserId: null,
      reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
    });
    await service.setPlaceReviewStatus(
      ADMIN_ID,
      PLACE_ID,
      PlaceReviewStatus.APPROVED,
    );
    expect(notificationsService.create).not.toHaveBeenCalled();
  });
});

describe("AdminService.bulkSetPlaceReviewStatus", () => {
  let service: AdminService;
  let placeRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };

  beforeEach(async () => {
    placeRepo = {
      findOne: jest.fn((opts: { where: { id: string } }) =>
        opts.where.id === "missing"
          ? Promise.resolve(null)
          : Promise.resolve({
              id: opts.where.id,
              reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
            }),
      ),
      save: jest.fn((data) => Promise.resolve(data)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Business), useValue: {} },
        { provide: getRepositoryToken(Creator), useValue: {} },
        { provide: getRepositoryToken(Review), useValue: {} },
        { provide: getRepositoryToken(PlaceFreshnessReport), useValue: {} },
        { provide: getRepositoryToken(Event), useValue: {} },
        { provide: getRepositoryToken(ContentReport), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Booking), useValue: {} },
        { provide: getRepositoryToken(BusinessContent), useValue: {} },
        { provide: getRepositoryToken(Advertisement), useValue: {} },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
        { provide: SettingsService, useValue: fakeSettingsService() },
        { provide: NotificationsService, useValue: inertNotificationsService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it("approves every id in the batch", async () => {
    const result = await service.bulkSetPlaceReviewStatus(
      ADMIN_ID,
      ["place-1", "place-2"],
      PlaceReviewStatus.APPROVED,
    );
    expect(result).toEqual({ succeeded: ["place-1", "place-2"], failed: [] });
    expect(placeRepo.save).toHaveBeenCalledTimes(2);
  });

  it("collects a failure without aborting the rest of the batch", async () => {
    const result = await service.bulkSetPlaceReviewStatus(
      ADMIN_ID,
      ["place-1", "missing", "place-3"],
      PlaceReviewStatus.REJECTED,
      "Duplicate listing",
    );
    expect(result.succeeded).toEqual(["place-1", "place-3"]);
    expect(result.failed).toEqual([
      { id: "missing", error: 'Place "missing" not found' },
    ]);
    expect(placeRepo.save).toHaveBeenCalledTimes(2);
  });
});

// bulkSetBusinessReviewStatus and bulkSetBusinessContentReviewStatus are
// thin wrappers over the same runBulk helper bulkSetPlaceReviewStatus
// exercises above (partial-failure collection is already covered there)
// — this just confirms each wrapper reaches its own repo/audit-log
// correctly, not runBulk's behavior a second time.
describe("AdminService bulk review-status: business and business-content", () => {
  let service: AdminService;
  let businessRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let businessContentRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let adminAuditService: { log: jest.Mock };

  beforeEach(async () => {
    businessRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: "biz-1", reviewStatus: "pending" }),
      save: jest.fn((data) => Promise.resolve(data)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };
    businessContentRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: "content-1", status: "pending" }),
      save: jest.fn((data) => Promise.resolve(data)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };
    adminAuditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Place), useValue: {} },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Creator), useValue: {} },
        { provide: getRepositoryToken(Review), useValue: {} },
        { provide: getRepositoryToken(PlaceFreshnessReport), useValue: {} },
        { provide: getRepositoryToken(Event), useValue: {} },
        { provide: getRepositoryToken(ContentReport), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Booking), useValue: {} },
        {
          provide: getRepositoryToken(BusinessContent),
          useValue: businessContentRepo,
        },
        { provide: getRepositoryToken(Advertisement), useValue: {} },
        { provide: AdminAuditService, useValue: adminAuditService },
        { provide: SettingsService, useValue: fakeSettingsService() },
        { provide: NotificationsService, useValue: inertNotificationsService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it("bulkSetBusinessReviewStatus approves a batch and audit-logs each", async () => {
    const result = await service.bulkSetBusinessReviewStatus(
      ADMIN_ID,
      ["biz-1", "biz-2"],
      "approved" as never,
    );
    expect(result).toEqual({ succeeded: ["biz-1", "biz-2"], failed: [] });
    expect(businessRepo.save).toHaveBeenCalledTimes(2);
    expect(adminAuditService.log).toHaveBeenCalledTimes(2);
  });

  it("bulkSetBusinessContentReviewStatus rejects a batch with a shared reason", async () => {
    const result = await service.bulkSetBusinessContentReviewStatus(
      ADMIN_ID,
      ["content-1"],
      "rejected" as never,
      "Off-topic",
    );
    expect(result).toEqual({ succeeded: ["content-1"], failed: [] });
    expect(businessContentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rejected",
        rejectionReason: "Off-topic",
      }),
    );
  });
});

// A self-submitted place sits invisible to the public until an admin acts
// on it (PlacesService.findAll's APPROVED-only gate) — so it must show up
// *somewhere* an admin will actually look, or it's stuck forever. This
// covers that it does.
describe("AdminService.getModerationQueue", () => {
  let service: AdminService;
  let placeRepo: { find: jest.Mock };
  let businessRepo: { find: jest.Mock };
  let freshnessQb: ReturnType<typeof emptyQueryBuilder>;
  let contentQb: ReturnType<typeof emptyQueryBuilder>;
  let advertisementRepo: { find: jest.Mock };
  let settingsService: ReturnType<typeof fakeSettingsService>;

  const PENDING_PLACE = {
    id: "place-2",
    name: "Sapo National Park Trailhead",
    reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
  };

  const PENDING_AD = {
    id: "ad-2",
    title: "Weekend photography course",
    reviewStatus: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW,
  };

  // The three other queue sources (possibly-closed places, flagged
  // content) drive their queries off QueryBuilder, not repo.find — stub
  // a chainable builder that resolves to no rows so those branches
  // short-circuit and never touch the other repo mocks.
  function emptyQueryBuilder() {
    const qb: Record<string, jest.Mock> = {};
    for (const method of [
      "select",
      "addSelect",
      "where",
      "andWhere",
      "groupBy",
      "addGroupBy",
      "having",
      "orderBy",
    ]) {
      qb[method] = jest.fn().mockReturnValue(qb);
    }
    qb.getRawMany = jest.fn().mockResolvedValue([]);
    return qb;
  }

  beforeEach(async () => {
    placeRepo = { find: jest.fn().mockResolvedValue([PENDING_PLACE]) };
    businessRepo = { find: jest.fn().mockResolvedValue([]) };
    freshnessQb = emptyQueryBuilder();
    contentQb = emptyQueryBuilder();
    advertisementRepo = { find: jest.fn().mockResolvedValue([PENDING_AD]) };
    settingsService = fakeSettingsService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Creator), useValue: {} },
        {
          provide: getRepositoryToken(Review),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(PlaceFreshnessReport),
          useValue: { createQueryBuilder: jest.fn(() => freshnessQb) },
        },
        { provide: getRepositoryToken(Event), useValue: {} },
        {
          provide: getRepositoryToken(ContentReport),
          useValue: { createQueryBuilder: jest.fn(() => contentQb) },
        },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Booking), useValue: {} },
        {
          provide: getRepositoryToken(BusinessContent),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Advertisement),
          useValue: advertisementRepo,
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
        { provide: SettingsService, useValue: settingsService },
        { provide: NotificationsService, useValue: inertNotificationsService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it("surfaces places awaiting a review decision, not just business claims", async () => {
    const queue = await service.getModerationQueue();
    expect(queue.pendingPlaces).toEqual([PENDING_PLACE]);
  });

  it("surfaces advertisements awaiting a review decision", async () => {
    const queue = await service.getModerationQueue();
    expect(queue.pendingAdvertisements).toEqual([PENDING_AD]);
    expect(advertisementRepo.find).toHaveBeenCalledWith({
      where: { reviewStatus: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW },
      order: { submittedAt: "DESC" },
    });
  });

  it("queries SUBMITTED_FOR_REVIEW/UNDER_REVIEW places with reviewer-facing relations, newest first", async () => {
    await service.getModerationQueue();
    expect(placeRepo.find).toHaveBeenCalledWith({
      where: [
        { reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW },
        { reviewStatus: PlaceReviewStatus.UNDER_REVIEW },
      ],
      relations: ["category", "county", "owner"],
      order: { submittedAt: "DESC" },
    });
  });

  it("uses Settings > Application's thresholds, not hardcoded defaults, once a super admin changes them", async () => {
    settingsService.getApplicationSettings.mockResolvedValue({
      freshnessFlagThreshold: 7,
      freshnessWindowDays: 30,
      reportFlagThreshold: 9,
      reportWindowDays: 14,
      failedLoginAlertThreshold1h: 5,
      failedLoginAlertThreshold24h: 20,
    });

    await service.getModerationQueue();

    expect(freshnessQb.having).toHaveBeenCalledWith("COUNT(*) >= :threshold", {
      threshold: 7,
    });
    expect(contentQb.having).toHaveBeenCalledWith("COUNT(*) >= :threshold", {
      threshold: 9,
    });
  });
});

describe("AdminService.setAdvertisementReviewStatus", () => {
  let service: AdminService;
  let advertisementRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let adminAuditService: { log: jest.Mock };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };

  beforeEach(async () => {
    advertisementRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: AD_ID,
        title: "Weekend photography course",
        ownerUserId: "owner-1",
        reviewStatus: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW,
      }),
      save: jest.fn((data) => Promise.resolve(data)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };
    adminAuditService = { log: jest.fn() };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createMany: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Place), useValue: {} },
        { provide: getRepositoryToken(Business), useValue: {} },
        { provide: getRepositoryToken(Creator), useValue: {} },
        { provide: getRepositoryToken(Review), useValue: {} },
        { provide: getRepositoryToken(PlaceFreshnessReport), useValue: {} },
        { provide: getRepositoryToken(Event), useValue: {} },
        { provide: getRepositoryToken(ContentReport), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Booking), useValue: {} },
        { provide: getRepositoryToken(BusinessContent), useValue: {} },
        {
          provide: getRepositoryToken(Advertisement),
          useValue: advertisementRepo,
        },
        { provide: AdminAuditService, useValue: adminAuditService },
        { provide: SettingsService, useValue: fakeSettingsService() },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it("404s an unknown advertisement", async () => {
    advertisementRepo.findOne.mockResolvedValue(null);
    await expect(
      service.setAdvertisementReviewStatus(
        ADMIN_ID,
        AD_ID,
        AdvertisementReviewStatus.APPROVED,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("approves a pending ad, clearing any rejection reason", async () => {
    await service.setAdvertisementReviewStatus(
      ADMIN_ID,
      AD_ID,
      AdvertisementReviewStatus.APPROVED,
    );
    expect(advertisementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: AdvertisementReviewStatus.APPROVED,
        rejectionReason: null,
        reviewedByUserId: ADMIN_ID,
        reviewedAt: expect.any(Date),
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        type: "advertisement.review_decided",
        body: expect.stringContaining("Weekend photography course"),
      }),
    );
  });

  it("rejects an ad with a reason and notifies the owner of it", async () => {
    await service.setAdvertisementReviewStatus(
      ADMIN_ID,
      AD_ID,
      AdvertisementReviewStatus.REJECTED,
      "Looks like spam",
    );
    expect(advertisementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: AdvertisementReviewStatus.REJECTED,
        rejectionReason: "Looks like spam",
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        type: "advertisement.review_decided",
        body: expect.stringContaining("Looks like spam"),
      }),
    );
  });

  it("suspends a live ad", async () => {
    advertisementRepo.findOne.mockResolvedValue({
      id: AD_ID,
      title: "Weekend photography course",
      ownerUserId: "owner-1",
      reviewStatus: AdvertisementReviewStatus.APPROVED,
    });
    await service.setAdvertisementReviewStatus(
      ADMIN_ID,
      AD_ID,
      AdvertisementReviewStatus.SUSPENDED,
      "Reported for a fake WhatsApp number",
    );
    expect(advertisementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reviewStatus: AdvertisementReviewStatus.SUSPENDED,
      }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({ type: "advertisement.review_decided" }),
    );
  });

  it("records the transition in the admin audit log", async () => {
    await service.setAdvertisementReviewStatus(
      ADMIN_ID,
      AD_ID,
      AdvertisementReviewStatus.APPROVED,
    );
    expect(adminAuditService.log).toHaveBeenCalledWith(
      ADMIN_ID,
      "advertisement.review_status_changed",
      "advertisement",
      AD_ID,
      {
        from: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW,
        to: AdvertisementReviewStatus.APPROVED,
        reason: null,
      },
      undefined,
    );
  });
});
