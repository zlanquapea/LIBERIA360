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

const ADMIN_ID = "admin-1";
const PLACE_ID = "place-1";

describe("AdminService.setPlaceReviewStatus", () => {
  let service: AdminService;
  let placeRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
  };
  let adminAuditService: { log: jest.Mock };

  beforeEach(async () => {
    placeRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: PLACE_ID,
        name: "Kpatawee Waterfall",
        reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      }),
      save: jest.fn((data) => Promise.resolve(data)),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
    };
    adminAuditService = { log: jest.fn() };

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
        { provide: AdminAuditService, useValue: adminAuditService },
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
});

// A self-submitted place sits invisible to the public until an admin acts
// on it (PlacesService.findAll's APPROVED-only gate) — so it must show up
// *somewhere* an admin will actually look, or it's stuck forever. This
// covers that it does.
describe("AdminService.getModerationQueue", () => {
  let service: AdminService;
  let placeRepo: { find: jest.Mock };
  let businessRepo: { find: jest.Mock };

  const PENDING_PLACE = {
    id: "place-2",
    name: "Sapo National Park Trailhead",
    reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
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
          useValue: { createQueryBuilder: jest.fn(() => emptyQueryBuilder()) },
        },
        { provide: getRepositoryToken(Event), useValue: {} },
        {
          provide: getRepositoryToken(ContentReport),
          useValue: { createQueryBuilder: jest.fn(() => emptyQueryBuilder()) },
        },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(Booking), useValue: {} },
        {
          provide: getRepositoryToken(BusinessContent),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: AdminAuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it("surfaces places awaiting a review decision, not just business claims", async () => {
    const queue = await service.getModerationQueue();
    expect(queue.pendingPlaces).toEqual([PENDING_PLACE]);
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
});
