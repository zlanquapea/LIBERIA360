import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BookingsService } from "./bookings.service";
import { Booking } from "./entities/booking.entity";
import { BookingStatus } from "./entities/booking.enums";
import { Business } from "../businesses/entities/business.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { CarListingReviewStatus } from "../car-listings/entities/car-listing.enums";
import { NotificationsService } from "../notifications/notifications.service";

describe("BookingsService", () => {
  let service: BookingsService;
  let bookingRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    exists: jest.Mock;
  };
  let businessRepo: { findOne: jest.Mock; exists: jest.Mock };
  let creatorRepo: { findOne: jest.Mock; exists: jest.Mock };
  let carListingRepo: { findOne: jest.Mock; find: jest.Mock };
  let notificationsService: { create: jest.Mock };

  beforeEach(async () => {
    bookingRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
      find: jest.fn().mockResolvedValue([]),
      exists: jest.fn().mockResolvedValue(false),
    };
    businessRepo = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    };
    creatorRepo = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    };
    carListingRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        { provide: getRepositoryToken(CarListing), useValue: carListingRepo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  function approvedCarListing(overrides: Partial<CarListing> = {}): CarListing {
    return {
      id: "car-1",
      ownerUserId: "owner-1",
      businessId: null,
      business: null,
      pricePerDay: 50,
      withDriverAvailable: true,
      driverFeePerDay: 20,
      minRentalDays: 1,
      pricePerHour: null,
      minRentalHours: null,
      driverFeePerHour: null,
      reviewStatus: CarListingReviewStatus.APPROVED,
      isActive: true,
      ...overrides,
    } as CarListing;
  }

  describe("create", () => {
    it("rejects a request with neither businessId nor creatorId", async () => {
      await expect(
        service.create("guest-1", { requestedDate: "2099-01-01" } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a request with both businessId and creatorId", async () => {
      await expect(
        service.create("guest-1", {
          businessId: "biz-1",
          creatorId: "creator-1",
          requestedDate: "2099-01-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a request for a business that doesn't exist", async () => {
      businessRepo.exists.mockResolvedValue(false);
      await expect(
        service.create("guest-1", {
          businessId: "biz-1",
          requestedDate: "2099-01-01",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a requestedDate in the past", async () => {
      await expect(
        service.create("guest-1", {
          businessId: "biz-1",
          requestedDate: "2000-01-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a requestedEndDate before requestedDate", async () => {
      await expect(
        service.create("guest-1", {
          businessId: "biz-1",
          requestedDate: "2099-06-10",
          requestedEndDate: "2099-06-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a request for a creator that doesn't exist", async () => {
      creatorRepo.exists.mockResolvedValue(false);
      await expect(
        service.create("guest-1", {
          creatorId: "creator-1",
          requestedDate: "2099-01-01",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("creates a booking against a creator", async () => {
      bookingRepo.save.mockResolvedValue({ id: "booking-1" });
      bookingRepo.findOneOrFail.mockResolvedValue({
        id: "booking-1",
        creatorId: "creator-1",
        businessId: null,
        guest: { name: "Ada" },
        requestedDate: "2099-01-01",
        creator: { userId: "creator-owner-1" },
      });
      await service.create("guest-1", {
        creatorId: "creator-1",
        requestedDate: "2099-01-01",
      });
      expect(bookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ creatorId: "creator-1", businessId: null }),
      );
    });

    it("rejects a car-listing request with no requestedEndDate", async () => {
      carListingRepo.findOne.mockResolvedValue(approvedCarListing());
      await expect(
        service.create("guest-1", {
          carListingId: "car-1",
          requestedDate: "2099-01-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a request for a car listing that isn't approved/active", async () => {
      carListingRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create("guest-1", {
          carListingId: "car-1",
          requestedDate: "2099-01-01",
          requestedEndDate: "2099-01-03",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a rental shorter than the listing's minRentalDays", async () => {
      carListingRepo.findOne.mockResolvedValue(
        approvedCarListing({ minRentalDays: 3 }),
      );
      await expect(
        service.create("guest-1", {
          carListingId: "car-1",
          requestedDate: "2099-01-01",
          requestedEndDate: "2099-01-02",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a car request overlapping an existing confirmed booking", async () => {
      carListingRepo.findOne.mockResolvedValue(approvedCarListing());
      bookingRepo.find.mockResolvedValue([
        {
          requestedDate: "2099-01-02",
          requestedEndDate: "2099-01-05",
          rentalUnit: null,
          requestedStartTime: null,
          requestedEndTime: null,
        },
      ]);
      await expect(
        service.create("guest-1", {
          carListingId: "car-1",
          requestedDate: "2099-01-01",
          requestedEndDate: "2099-01-03",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("allows a day-mode car request that doesn't overlap an existing confirmed booking", async () => {
      carListingRepo.findOne.mockResolvedValue(approvedCarListing());
      bookingRepo.find.mockResolvedValue([
        {
          requestedDate: "2099-02-01",
          requestedEndDate: "2099-02-03",
          rentalUnit: null,
          requestedStartTime: null,
          requestedEndTime: null,
        },
      ]);
      bookingRepo.save.mockResolvedValue({ id: "booking-1" });
      bookingRepo.findOneOrFail.mockResolvedValue({
        id: "booking-1",
        guest: { name: "Ada" },
        requestedDate: "2099-01-01",
        carListing: { ownerUserId: "owner-1", title: "RAV4" },
      });

      await service.create("guest-1", {
        carListingId: "car-1",
        requestedDate: "2099-01-01",
        requestedEndDate: "2099-01-03",
      });

      expect(bookingRepo.save).toHaveBeenCalled();
    });

    describe("hourly car rental", () => {
      it("rejects hour-mode on a listing without pricePerHour", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: null }),
        );
        await expect(
          service.create("guest-1", {
            carListingId: "car-1",
            requestedDate: "2099-01-01",
            rentalUnit: "hour" as never,
            requestedStartTime: "09:00",
            requestedEndTime: "11:00",
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(bookingRepo.save).not.toHaveBeenCalled();
      });

      it("rejects hour-mode missing requestedStartTime/requestedEndTime", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: 10 }),
        );
        await expect(
          service.create("guest-1", {
            carListingId: "car-1",
            requestedDate: "2099-01-01",
            rentalUnit: "hour" as never,
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(bookingRepo.save).not.toHaveBeenCalled();
      });

      it("rejects requestedEndTime not after requestedStartTime", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: 10 }),
        );
        await expect(
          service.create("guest-1", {
            carListingId: "car-1",
            requestedDate: "2099-01-01",
            rentalUnit: "hour" as never,
            requestedStartTime: "11:00",
            requestedEndTime: "09:00",
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(bookingRepo.save).not.toHaveBeenCalled();
      });

      it("rejects a rental shorter than the listing's minRentalHours", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: 10, minRentalHours: 3 }),
        );
        await expect(
          service.create("guest-1", {
            carListingId: "car-1",
            requestedDate: "2099-01-01",
            rentalUnit: "hour" as never,
            requestedStartTime: "09:00",
            requestedEndTime: "10:00",
          }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(bookingRepo.save).not.toHaveBeenCalled();
      });

      it("computes estimatedTotal for an hourly rental, rounding up a partial hour", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: 10 }),
        );
        bookingRepo.save.mockResolvedValue({ id: "booking-1" });
        bookingRepo.findOneOrFail.mockResolvedValue({
          id: "booking-1",
          guest: { name: "Ada" },
          requestedDate: "2099-01-01",
          rentalUnit: "hour",
          requestedStartTime: "09:00",
          requestedEndTime: "10:30",
          carListing: { ownerUserId: "owner-1", title: "RAV4" },
        });

        await service.create("guest-1", {
          carListingId: "car-1",
          requestedDate: "2099-01-01",
          rentalUnit: "hour" as never,
          requestedStartTime: "09:00",
          requestedEndTime: "10:30", // 1.5h -> rounds up to 2h
        });

        expect(bookingRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            rentalUnit: "hour",
            requestedStartTime: "09:00",
            requestedEndTime: "10:30",
            requestedEndDate: null,
            estimatedTotal: 20, // 2h * $10
          }),
        );
      });

      it("adds the hourly driver fee when withDriver is requested and available", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: 10, driverFeePerHour: 5 }),
        );
        bookingRepo.save.mockResolvedValue({ id: "booking-1" });
        bookingRepo.findOneOrFail.mockResolvedValue({
          id: "booking-1",
          guest: { name: "Ada" },
          requestedDate: "2099-01-01",
          rentalUnit: "hour",
          requestedStartTime: "09:00",
          requestedEndTime: "11:00",
          carListing: { ownerUserId: "owner-1", title: "RAV4" },
        });

        await service.create("guest-1", {
          carListingId: "car-1",
          requestedDate: "2099-01-01",
          rentalUnit: "hour" as never,
          requestedStartTime: "09:00",
          requestedEndTime: "11:00", // 2h
          withDriver: true,
        });

        expect(bookingRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ estimatedTotal: 30 }), // 2h * ($10 + $5)
        );
      });

      it("rejects an hourly request overlapping an existing confirmed hourly booking", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: 10 }),
        );
        bookingRepo.find.mockResolvedValue([
          {
            requestedDate: "2099-01-01",
            requestedEndDate: null,
            rentalUnit: "hour",
            requestedStartTime: "09:30",
            requestedEndTime: "11:00",
          },
        ]);
        await expect(
          service.create("guest-1", {
            carListingId: "car-1",
            requestedDate: "2099-01-01",
            rentalUnit: "hour" as never,
            requestedStartTime: "10:00",
            requestedEndTime: "12:00",
          }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(bookingRepo.save).not.toHaveBeenCalled();
      });

      it("allows a non-overlapping hourly request on the same day as a confirmed booking", async () => {
        carListingRepo.findOne.mockResolvedValue(
          approvedCarListing({ pricePerHour: 10 }),
        );
        bookingRepo.find.mockResolvedValue([
          {
            requestedDate: "2099-01-01",
            requestedEndDate: null,
            rentalUnit: "hour",
            requestedStartTime: "08:00",
            requestedEndTime: "09:00",
          },
        ]);
        bookingRepo.save.mockResolvedValue({ id: "booking-1" });
        bookingRepo.findOneOrFail.mockResolvedValue({
          id: "booking-1",
          guest: { name: "Ada" },
          requestedDate: "2099-01-01",
          carListing: { ownerUserId: "owner-1", title: "RAV4" },
        });

        await service.create("guest-1", {
          carListingId: "car-1",
          requestedDate: "2099-01-01",
          rentalUnit: "hour" as never,
          requestedStartTime: "10:00",
          requestedEndTime: "12:00",
        });

        expect(bookingRepo.save).toHaveBeenCalled();
      });
    });

    it("computes estimatedTotal for a car rental without a driver", async () => {
      carListingRepo.findOne.mockResolvedValue(approvedCarListing());
      bookingRepo.save.mockResolvedValue({ id: "booking-1" });
      bookingRepo.findOneOrFail.mockResolvedValue({
        id: "booking-1",
        guest: { name: "Ada" },
        requestedDate: "2099-01-01",
        carListing: { ownerUserId: "owner-1", title: "RAV4" },
      });

      await service.create("guest-1", {
        carListingId: "car-1",
        requestedDate: "2099-01-01",
        requestedEndDate: "2099-01-04", // 3 days
      });

      expect(bookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          carListingId: "car-1",
          withDriver: false,
          estimatedTotal: 150, // 3 days * $50
        }),
      );
    });

    it("adds the driver fee to estimatedTotal when withDriver is requested and available", async () => {
      carListingRepo.findOne.mockResolvedValue(approvedCarListing());
      bookingRepo.save.mockResolvedValue({ id: "booking-1" });
      bookingRepo.findOneOrFail.mockResolvedValue({
        id: "booking-1",
        guest: { name: "Ada" },
        requestedDate: "2099-01-01",
        carListing: { ownerUserId: "owner-1", title: "RAV4" },
      });

      await service.create("guest-1", {
        carListingId: "car-1",
        requestedDate: "2099-01-01",
        requestedEndDate: "2099-01-03", // 2 days
        withDriver: true,
      });

      expect(bookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          withDriver: true,
          estimatedTotal: 140, // 2 days * ($50 + $20)
        }),
      );
    });

    it("ignores withDriver when the listing doesn't offer a driver", async () => {
      carListingRepo.findOne.mockResolvedValue(
        approvedCarListing({ withDriverAvailable: false }),
      );
      bookingRepo.save.mockResolvedValue({ id: "booking-1" });
      bookingRepo.findOneOrFail.mockResolvedValue({
        id: "booking-1",
        guest: { name: "Ada" },
        requestedDate: "2099-01-01",
        carListing: { ownerUserId: "owner-1", title: "RAV4" },
      });

      await service.create("guest-1", {
        carListingId: "car-1",
        requestedDate: "2099-01-01",
        requestedEndDate: "2099-01-03",
        withDriver: true,
      });

      expect(bookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ withDriver: false, estimatedTotal: 100 }),
      );
    });

    it("notifies the business/creator owner of a new request", async () => {
      bookingRepo.save.mockResolvedValue({ id: "booking-1" });
      bookingRepo.findOneOrFail.mockResolvedValue({
        id: "booking-1",
        guest: { name: "Ada" },
        requestedDate: "2099-01-01",
        business: { ownerUserId: "owner-1" },
      });
      await service.create("guest-1", {
        businessId: "biz-1",
        requestedDate: "2099-01-01",
      });
      expect(notificationsService.create).toHaveBeenCalledWith(
        "owner-1",
        expect.objectContaining({
          type: "booking.requested",
          body: expect.stringContaining("Ada"),
        }),
      );
    });

    it("doesn't notify anyone when the listing has no resolvable owner", async () => {
      bookingRepo.save.mockResolvedValue({ id: "booking-1" });
      bookingRepo.findOneOrFail.mockResolvedValue({
        id: "booking-1",
        guest: { name: "Ada" },
        requestedDate: "2099-01-01",
        business: null,
        creator: null,
      });
      await service.create("guest-1", {
        businessId: "biz-1",
        requestedDate: "2099-01-01",
      });
      expect(notificationsService.create).not.toHaveBeenCalled();
    });
  });

  describe("respond", () => {
    it("rejects a non-owner responding", async () => {
      bookingRepo.findOne.mockResolvedValue({
        id: "booking-1",
        status: BookingStatus.PENDING,
        business: { ownerUserId: "owner-1" },
      });
      await expect(
        service.respond("someone-else", "booking-1", { action: "confirm" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects responding to an already-responded booking", async () => {
      bookingRepo.findOne.mockResolvedValue({
        id: "booking-1",
        status: BookingStatus.CONFIRMED,
        business: { ownerUserId: "owner-1" },
      });
      await expect(
        service.respond("owner-1", "booking-1", { action: "decline" }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("confirms a pending booking owned by the caller", async () => {
      const booking = {
        id: "booking-1",
        status: BookingStatus.PENDING,
        guestUserId: "guest-1",
        requestedDate: "2099-01-01",
        business: { ownerUserId: "owner-1", name: "CeeCee Tours" },
      };
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.findOneOrFail.mockResolvedValue({
        ...booking,
        status: BookingStatus.CONFIRMED,
      });

      await service.respond("owner-1", "booking-1", {
        action: "confirm",
        message: "See you then",
      });

      expect(bookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BookingStatus.CONFIRMED,
          businessResponse: "See you then",
        }),
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        "guest-1",
        expect.objectContaining({
          type: "booking.confirmed",
          body: expect.stringContaining("CeeCee Tours"),
        }),
      );
    });

    it("confirms a pending booking owned by the caller creator", async () => {
      const booking = {
        id: "booking-1",
        status: BookingStatus.PENDING,
        guestUserId: "guest-1",
        requestedDate: "2099-01-01",
        creator: { userId: "creator-owner-1" },
      };
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.findOneOrFail.mockResolvedValue({
        ...booking,
        status: BookingStatus.CONFIRMED,
      });

      await service.respond("creator-owner-1", "booking-1", {
        action: "confirm",
      });

      expect(bookingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BookingStatus.CONFIRMED }),
      );
    });

    it("notifies the guest when their request is declined", async () => {
      const booking = {
        id: "booking-1",
        status: BookingStatus.PENDING,
        guestUserId: "guest-1",
        requestedDate: "2099-01-01",
        business: { ownerUserId: "owner-1", name: "CeeCee Tours" },
      };
      bookingRepo.findOne.mockResolvedValue(booking);
      bookingRepo.findOneOrFail.mockResolvedValue({
        ...booking,
        status: BookingStatus.DECLINED,
      });

      await service.respond("owner-1", "booking-1", { action: "decline" });

      expect(notificationsService.create).toHaveBeenCalledWith(
        "guest-1",
        expect.objectContaining({ type: "booking.declined" }),
      );
    });
  });

  describe("findForBusiness", () => {
    it("rejects a non-owner", async () => {
      businessRepo.findOne.mockResolvedValue({
        id: "biz-1",
        ownerUserId: "owner-1",
      });
      await expect(
        service.findForBusiness("someone-else", "biz-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects a business that doesn't exist", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findForBusiness("owner-1", "biz-1"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("queries by businessId alone when the business has no car listings", async () => {
      businessRepo.findOne.mockResolvedValue({
        id: "biz-1",
        ownerUserId: "owner-1",
      });
      carListingRepo.find.mockResolvedValue([]);
      bookingRepo.find.mockResolvedValue([]);

      await service.findForBusiness("owner-1", "biz-1");

      expect(bookingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: "biz-1" } }),
      );
    });

    it("merges direct business bookings with bookings against the business's car listings", async () => {
      businessRepo.findOne.mockResolvedValue({
        id: "biz-1",
        ownerUserId: "owner-1",
      });
      carListingRepo.find.mockResolvedValue([{ id: "car-1" }, { id: "car-2" }]);
      const bookings = [{ id: "booking-1" }, { id: "booking-2" }];
      bookingRepo.find.mockResolvedValue(bookings);

      const result = await service.findForBusiness("owner-1", "biz-1");

      expect(carListingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: "biz-1" } }),
      );
      expect(bookingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ businessId: "biz-1" }, { carListingId: expect.anything() }],
        }),
      );
      expect(result).toBe(bookings);
    });
  });

  describe("findForCarListingOwner", () => {
    it("returns an empty list when the caller has listed no cars", async () => {
      carListingRepo.find.mockResolvedValue([]);
      const result = await service.findForCarListingOwner("owner-1");
      expect(result).toEqual([]);
      expect(bookingRepo.find).not.toHaveBeenCalled();
    });

    it("queries bookings across every car the caller owns directly, no business involved", async () => {
      carListingRepo.find.mockResolvedValue([{ id: "car-1" }, { id: "car-2" }]);
      const bookings = [{ id: "booking-1" }];
      bookingRepo.find.mockResolvedValue(bookings);

      const result = await service.findForCarListingOwner("owner-1");

      expect(carListingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerUserId: "owner-1" } }),
      );
      expect(bookingRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { carListingId: expect.anything() },
        }),
      );
      expect(result).toBe(bookings);
    });
  });

  describe("cancel", () => {
    it("rejects a non-guest cancelling", async () => {
      bookingRepo.findOne.mockResolvedValue({
        id: "booking-1",
        status: BookingStatus.PENDING,
        guestUserId: "guest-1",
      });
      await expect(
        service.cancel("someone-else", "booking-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects cancelling an already-declined booking", async () => {
      bookingRepo.findOne.mockResolvedValue({
        id: "booking-1",
        status: BookingStatus.DECLINED,
        guestUserId: "guest-1",
      });
      await expect(
        service.cancel("guest-1", "booking-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
