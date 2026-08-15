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

describe("BookingsService", () => {
  let service: BookingsService;
  let bookingRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let businessRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    bookingRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
      find: jest.fn(),
    };
    businessRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  describe("create", () => {
    it("rejects a request for a business that doesn't exist", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create("guest-1", {
          businessId: "biz-1",
          requestedDate: "2099-01-01",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a requestedDate in the past", async () => {
      businessRepo.findOne.mockResolvedValue({ id: "biz-1" });
      await expect(
        service.create("guest-1", {
          businessId: "biz-1",
          requestedDate: "2000-01-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
    });

    it("rejects a requestedEndDate before requestedDate", async () => {
      businessRepo.findOne.mockResolvedValue({ id: "biz-1" });
      await expect(
        service.create("guest-1", {
          businessId: "biz-1",
          requestedDate: "2099-06-10",
          requestedEndDate: "2099-06-01",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(bookingRepo.save).not.toHaveBeenCalled();
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
        business: { ownerUserId: "owner-1" },
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
