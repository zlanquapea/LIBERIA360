import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { In } from "typeorm";
import { CarListingsService } from "./car-listings.service";
import { CarListing } from "./entities/car-listing.entity";
import { CarListingBlockedDate } from "./entities/car-listing-blocked-date.entity";
import { CarListingReviewStatus } from "./entities/car-listing.enums";
import { Business } from "../businesses/entities/business.entity";
import { County } from "../counties/entities/county.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const BUSINESS_ID = "biz-1";
const COUNTY_ID = "county-1";
const LISTING_ID = "listing-1";

describe("CarListingsService", () => {
  let service: CarListingsService;
  let carListingRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
    getManyAndCount: jest.Mock;
    wheres: Array<{ sql: string; params: unknown }>;
  };
  let businessRepo: { findOne: jest.Mock };
  let countyRepo: { exists: jest.Mock };
  let blockedDateRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let fakeBlockedDateManager: { query: jest.Mock };
  let bookingRepo: { find: jest.Mock };
  let notificationsService: { createMany: jest.Mock };
  let usersService: { findAdminIds: jest.Mock };

  beforeEach(async () => {
    const trackWhere = function (
      this: typeof queryBuilder,
      sql: string,
      params: unknown,
    ) {
      this.wheres.push({ sql, params });
      return this;
    };
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn(trackWhere),
      andWhere: jest.fn(trackWhere),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      wheres: [],
    };

    carListingRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: LISTING_ID, ...data })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn((opts) => Promise.resolve({ id: opts.where.id })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    businessRepo = { findOne: jest.fn() };
    countyRepo = { exists: jest.fn().mockResolvedValue(true) };
    blockedDateRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: "blocked-1", ...data })),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: { transaction: jest.fn() },
    };
    // CarListingsService.createBlockedDate wraps its insert in
    // `this.blockedDateRepo.manager.transaction(...)` to take the same
    // per-listing advisory lock BookingsService.create uses — see its own
    // doc comment. The fake manager just forwards to the mocks above.
    fakeBlockedDateManager = {
      query: jest.fn().mockResolvedValue(undefined),
    };
    blockedDateRepo.manager.transaction.mockImplementation(
      (cb: (m: unknown) => unknown) =>
        cb({
          ...fakeBlockedDateManager,
          create: jest.fn((_entity: unknown, data: unknown) =>
            blockedDateRepo.create(data),
          ),
          save: jest.fn((_entity: unknown, data: unknown) =>
            blockedDateRepo.save(data),
          ),
        }),
    );
    bookingRepo = { find: jest.fn().mockResolvedValue([]) };
    notificationsService = {
      createMany: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findAdminIds: jest.fn().mockResolvedValue(["admin-1", "admin-2"]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarListingsService,
        { provide: getRepositoryToken(CarListing), useValue: carListingRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(County), useValue: countyRepo },
        {
          provide: getRepositoryToken(CarListingBlockedDate),
          useValue: blockedDateRepo,
        },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(CarListingsService);
  });

  const CREATE_DTO = {
    countyId: COUNTY_ID,
    title: "2022 Toyota RAV4",
    make: "Toyota",
    model: "RAV4",
    year: 2022,
    category: "suv",
    transmission: "automatic",
    fuelType: "petrol",
    seats: 5,
    pricePerDay: 50,
  };

  describe("create", () => {
    it("submits straight to SUBMITTED_FOR_REVIEW, not DRAFT, owned directly by the caller", async () => {
      await service.create(OWNER_ID, CREATE_DTO as never);
      expect(carListingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerUserId: OWNER_ID,
          businessId: null,
          countyId: COUNTY_ID,
          reviewStatus: CarListingReviewStatus.SUBMITTED_FOR_REVIEW,
          submittedAt: expect.any(Date),
        }),
      );
      expect(businessRepo.findOne).not.toHaveBeenCalled();
    });

    it("notifies every admin that a listing is pending review", async () => {
      await service.create(OWNER_ID, CREATE_DTO as never);
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        ["admin-1", "admin-2"],
        expect.objectContaining({
          type: "admin.car_listing_pending_review",
          body: expect.stringContaining("2022 Toyota RAV4"),
        }),
      );
    });

    it("defaults optional fields to empty/null", async () => {
      await service.create(OWNER_ID, CREATE_DTO as never);
      expect(carListingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          withDriverAvailable: false,
          driverFeePerDay: null,
          minRentalDays: 1,
          pricePerHour: null,
          minRentalHours: null,
          driverFeePerHour: null,
          securityDeposit: null,
          features: [],
          images: [],
          description: null,
          pickupLocation: null,
          contactPhone: null,
          contactWhatsapp: null,
        }),
      );
    });

    it("defaults minRentalHours to 1 once pricePerHour opts the listing into hourly rental", async () => {
      await service.create(OWNER_ID, {
        ...CREATE_DTO,
        pricePerHour: 8,
      } as never);
      expect(carListingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pricePerHour: 8, minRentalHours: 1 }),
      );
    });

    it("honors an explicit minRentalHours/driverFeePerHour", async () => {
      await service.create(OWNER_ID, {
        ...CREATE_DTO,
        pricePerHour: 8,
        minRentalHours: 3,
        driverFeePerHour: 4,
      } as never);
      expect(carListingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          pricePerHour: 8,
          minRentalHours: 3,
          driverFeePerHour: 4,
        }),
      );
    });

    it("400s a county that doesn't exist", async () => {
      countyRepo.exists.mockResolvedValue(false);
      await expect(
        service.create(OWNER_ID, CREATE_DTO as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(carListingRepo.save).not.toHaveBeenCalled();
    });

    it("links an optional business the caller owns", async () => {
      businessRepo.findOne.mockResolvedValue({
        id: BUSINESS_ID,
        ownerUserId: OWNER_ID,
      });
      await service.create(OWNER_ID, {
        ...CREATE_DTO,
        businessId: BUSINESS_ID,
      } as never);
      expect(carListingRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ businessId: BUSINESS_ID }),
      );
    });

    it("404s an optional business that doesn't exist", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(OWNER_ID, {
          ...CREATE_DTO,
          businessId: BUSINESS_ID,
        } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(carListingRepo.save).not.toHaveBeenCalled();
    });

    it("403s a caller trying to link a business they don't own", async () => {
      businessRepo.findOne.mockResolvedValue({
        id: BUSINESS_ID,
        ownerUserId: STRANGER_ID,
      });
      await expect(
        service.create(OWNER_ID, {
          ...CREATE_DTO,
          businessId: BUSINESS_ID,
        } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(carListingRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("findMine / findOne", () => {
    it("queries the caller's own fleet directly by ownerUserId, across every review status, newest first", async () => {
      await service.findMine(OWNER_ID);
      expect(carListingRepo.find).toHaveBeenCalledWith({
        where: { ownerUserId: OWNER_ID },
        order: { createdAt: "DESC" },
      });
    });

    it("404s an unknown listing", async () => {
      await expect(
        service.findOne(OWNER_ID, LISTING_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s a user who doesn't own the listing", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
      });
      await expect(
        service.findOne(STRANGER_ID, LISTING_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns the listing for its owner", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
      });
      await expect(
        service.findOne(OWNER_ID, LISTING_ID),
      ).resolves.toMatchObject({ id: LISTING_ID });
    });
  });

  describe("update", () => {
    it("resubmits a REJECTED listing for review, clearing the rejection reason", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
        reviewStatus: CarListingReviewStatus.REJECTED,
        rejectionReason: "Photos too blurry",
      });
      await service.update(OWNER_ID, LISTING_ID, {
        title: "Better title",
      } as never);
      expect(carListingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Better title",
          reviewStatus: CarListingReviewStatus.SUBMITTED_FOR_REVIEW,
          rejectionReason: null,
        }),
      );
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        ["admin-1", "admin-2"],
        expect.objectContaining({ type: "admin.car_listing_pending_review" }),
      );
    });

    it("does NOT auto-resubmit a SUSPENDED listing on edit", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
        reviewStatus: CarListingReviewStatus.SUSPENDED,
      });
      await service.update(OWNER_ID, LISTING_ID, {
        title: "New title",
      } as never);
      expect(carListingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: CarListingReviewStatus.SUSPENDED,
        }),
      );
      expect(notificationsService.createMany).not.toHaveBeenCalled();
    });

    it("leaves an APPROVED listing's status alone on a plain edit", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
        reviewStatus: CarListingReviewStatus.APPROVED,
      });
      await service.update(OWNER_ID, LISTING_ID, { isActive: false } as never);
      expect(carListingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewStatus: CarListingReviewStatus.APPROVED,
        }),
      );
      expect(notificationsService.createMany).not.toHaveBeenCalled();
    });

    it("validates a new countyId when one is provided", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
        reviewStatus: CarListingReviewStatus.APPROVED,
      });
      countyRepo.exists.mockResolvedValue(false);
      await expect(
        service.update(OWNER_ID, LISTING_ID, { countyId: "bogus" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(carListingRepo.save).not.toHaveBeenCalled();
    });

    it("403s a stranger trying to edit someone else's listing", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
      });
      await expect(
        service.update(STRANGER_ID, LISTING_ID, { title: "Hijacked" } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(carListingRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("deletes the caller's own listing", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
      });
      await service.remove(OWNER_ID, LISTING_ID);
      expect(carListingRepo.delete).toHaveBeenCalledWith({ id: LISTING_ID });
    });

    it("403s a stranger trying to delete someone else's listing", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
      });
      await expect(
        service.remove(STRANGER_ID, LISTING_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(carListingRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("findAllApproved", () => {
    it("queries approved AND active listings only, newest first", async () => {
      await service.findAllApproved();
      expect(queryBuilder.where).toHaveBeenCalledWith(
        "listing.reviewStatus = :reviewStatus",
        { reviewStatus: CarListingReviewStatus.APPROVED },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "listing.isActive = true",
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        "listing.createdAt",
        "DESC",
      );
    });

    it("paginates using the default page/limit when none is given", async () => {
      const result = await service.findAllApproved();
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it("applies category/transmission/county/seats/price/driver filters when provided", async () => {
      await service.findAllApproved({
        category: "suv",
        transmission: "automatic",
        countyId: COUNTY_ID,
        minSeats: 4,
        maxPricePerDay: 100,
        withDriverAvailable: true,
      } as never);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "listing.category = :category",
        { category: "suv" },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "listing.transmission = :transmission",
        { transmission: "automatic" },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "listing.countyId = :countyId",
        { countyId: COUNTY_ID },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "listing.seats >= :minSeats",
        { minSeats: 4 },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "listing.pricePerDay <= :maxPricePerDay",
        { maxPricePerDay: 100 },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "listing.withDriverAvailable = true",
      );
    });
  });

  describe("findApprovedOne", () => {
    it("returns an approved, active listing by id", async () => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        reviewStatus: CarListingReviewStatus.APPROVED,
        isActive: true,
      });
      await expect(service.findApprovedOne(LISTING_ID)).resolves.toMatchObject({
        id: LISTING_ID,
      });
      expect(carListingRepo.findOne).toHaveBeenCalledWith({
        where: {
          id: LISTING_ID,
          reviewStatus: CarListingReviewStatus.APPROVED,
          isActive: true,
        },
      });
    });

    it("404s a listing that isn't approved/active (pending, rejected, suspended, paused, or unknown)", async () => {
      carListingRepo.findOne.mockResolvedValue(null);
      await expect(service.findApprovedOne(LISTING_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("createBlockedDate / findBlockedDates / removeBlockedDate", () => {
    beforeEach(() => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        ownerUserId: OWNER_ID,
      });
    });

    it("lets the owner block a date range with an optional reason", async () => {
      await service.createBlockedDate(OWNER_ID, LISTING_ID, {
        startDate: "2026-11-01",
        endDate: "2026-11-05",
        reason: "In the shop",
      });
      expect(fakeBlockedDateManager.query).toHaveBeenCalledWith(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [LISTING_ID],
      );
      expect(blockedDateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          carListingId: LISTING_ID,
          startDate: "2026-11-01",
          endDate: "2026-11-05",
          reason: "In the shop",
        }),
      );
    });

    it("defaults reason to null when omitted", async () => {
      await service.createBlockedDate(OWNER_ID, LISTING_ID, {
        startDate: "2026-11-01",
        endDate: "2026-11-05",
      });
      expect(blockedDateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ reason: null }),
      );
    });

    it("400s when endDate is before startDate", async () => {
      await expect(
        service.createBlockedDate(OWNER_ID, LISTING_ID, {
          startDate: "2026-11-05",
          endDate: "2026-11-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(blockedDateRepo.save).not.toHaveBeenCalled();
    });

    it("403s a stranger trying to block dates on someone else's listing", async () => {
      await expect(
        service.createBlockedDate(STRANGER_ID, LISTING_ID, {
          startDate: "2026-11-01",
          endDate: "2026-11-05",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(blockedDateRepo.save).not.toHaveBeenCalled();
    });

    it("lists the owner's own blocked dates, earliest first", async () => {
      await service.findBlockedDates(OWNER_ID, LISTING_ID);
      expect(blockedDateRepo.find).toHaveBeenCalledWith({
        where: { carListingId: LISTING_ID },
        order: { startDate: "ASC" },
      });
    });

    it("403s a stranger trying to list someone else's blocked dates", async () => {
      await expect(
        service.findBlockedDates(STRANGER_ID, LISTING_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("deletes a blocked date scoped to both the id and the listing", async () => {
      await service.removeBlockedDate(OWNER_ID, LISTING_ID, "blocked-1");
      expect(blockedDateRepo.delete).toHaveBeenCalledWith({
        id: "blocked-1",
        carListingId: LISTING_ID,
      });
    });

    it("403s a stranger trying to delete someone else's blocked date", async () => {
      await expect(
        service.removeBlockedDate(STRANGER_ID, LISTING_ID, "blocked-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(blockedDateRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe("getAvailability", () => {
    beforeEach(() => {
      carListingRepo.findOne.mockResolvedValue({
        id: LISTING_ID,
        reviewStatus: CarListingReviewStatus.APPROVED,
        isActive: true,
      });
    });

    it("merges CONFIRMED/PENDING bookings and blocked dates, omitting the private reason", async () => {
      bookingRepo.find.mockResolvedValue([
        { requestedDate: "2026-12-01", requestedEndDate: "2026-12-03" },
      ]);
      blockedDateRepo.find.mockResolvedValue([
        {
          startDate: "2026-12-10",
          endDate: "2026-12-12",
          reason: "personal trip",
        },
      ]);
      const result = await service.getAvailability(LISTING_ID);
      expect(bookingRepo.find).toHaveBeenCalledWith({
        where: {
          carListingId: LISTING_ID,
          status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
        },
      });
      expect(result).toEqual({
        carListingId: LISTING_ID,
        unavailable: [
          {
            startDate: "2026-12-01",
            endDate: "2026-12-03",
            source: "booking",
          },
          { startDate: "2026-12-10", endDate: "2026-12-12", source: "blocked" },
        ],
      });
    });

    it("404s for a listing that isn't public (same gate as the detail page)", async () => {
      carListingRepo.findOne.mockResolvedValue(null);
      await expect(service.getAvailability(LISTING_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
