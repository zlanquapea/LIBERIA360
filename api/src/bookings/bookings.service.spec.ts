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
import { NotificationsService } from "../notifications/notifications.service";

describe("BookingsService", () => {
  let service: BookingsService;
  let bookingRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let businessRepo: { findOne: jest.Mock; exists: jest.Mock };
  let creatorRepo: { findOne: jest.Mock; exists: jest.Mock };
  let notificationsService: { create: jest.Mock };

  beforeEach(async () => {
    bookingRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
      find: jest.fn(),
    };
    businessRepo = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    };
    creatorRepo = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(Creator), useValue: creatorRepo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

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
