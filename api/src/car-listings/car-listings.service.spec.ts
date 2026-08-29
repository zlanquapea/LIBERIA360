import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CarListingsService } from "./car-listings.service";
import { CarListing } from "./entities/car-listing.entity";
import { CarListingReviewStatus } from "./entities/car-listing.enums";
import { Business } from "../businesses/entities/business.entity";
import { County } from "../counties/entities/county.entity";
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
});
