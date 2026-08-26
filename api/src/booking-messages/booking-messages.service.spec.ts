import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BookingMessagesService } from "./booking-messages.service";
import { BookingMessage } from "./entities/booking-message.entity";
import { Booking } from "../bookings/entities/booking.entity";

const GUEST_ID = "guest-1";
const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const BOOKING_ID = "booking-1";

const BOOKING = {
  id: BOOKING_ID,
  guestUserId: GUEST_ID,
  business: { ownerUserId: OWNER_ID },
};

describe("BookingMessagesService", () => {
  let service: BookingMessagesService;
  let messageRepo: {
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOneOrFail: jest.Mock;
    update: jest.Mock;
  };
  let bookingRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    let saved: Record<string, unknown> = {};
    messageRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((data) => {
        saved = { id: "message-1", ...data };
        return saved;
      }),
      create: jest.fn((data) => data),
      findOneOrFail: jest.fn(() => saved),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    bookingRepo = {
      findOne: jest.fn().mockResolvedValue(BOOKING),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingMessagesService,
        { provide: getRepositoryToken(BookingMessage), useValue: messageRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
      ],
    }).compile();

    service = module.get(BookingMessagesService);
  });

  it("rejects posting to a booking that doesn't exist", async () => {
    bookingRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(GUEST_ID, BOOKING_ID, { body: "hi" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a user who is neither the guest nor the business owner", async () => {
    await expect(
      service.create(STRANGER_ID, BOOKING_ID, { body: "hi" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it("lets the guest post a message", async () => {
    const result = await service.create(GUEST_ID, BOOKING_ID, {
      body: "What time is check-in?",
    });
    expect(result).toMatchObject({
      bookingId: BOOKING_ID,
      senderUserId: GUEST_ID,
      body: "What time is check-in?",
    });
  });

  it("lets the business owner post a message", async () => {
    const result = await service.create(OWNER_ID, BOOKING_ID, {
      body: "Check-in is at 2pm.",
    });
    expect(result).toMatchObject({
      bookingId: BOOKING_ID,
      senderUserId: OWNER_ID,
    });
  });

  it("rejects a stranger reading the thread", async () => {
    await expect(
      service.findForBooking(STRANGER_ID, BOOKING_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns the thread ordered oldest-first for a participant", async () => {
    await service.findForBooking(GUEST_ID, BOOKING_ID);
    expect(messageRepo.find).toHaveBeenCalledWith({
      where: { bookingId: BOOKING_ID },
      order: { createdAt: "ASC" },
    });
  });

  describe("markRead", () => {
    it("rejects a stranger", async () => {
      await expect(
        service.markRead(STRANGER_ID, BOOKING_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(messageRepo.update).not.toHaveBeenCalled();
    });

    it("marks only the other participant's unread messages as read", async () => {
      await service.markRead(OWNER_ID, BOOKING_ID);
      expect(messageRepo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = messageRepo.update.mock.calls[0];
      expect(where).toMatchObject({ bookingId: BOOKING_ID });
      expect(patch.readAt).toBeInstanceOf(Date);
      // Not(userId) / IsNull() are TypeORM FindOperator instances — assert
      // on their internal _type/_value rather than a plain equality check.
      expect(where.senderUserId).toMatchObject({
        _type: "not",
        _value: OWNER_ID,
      });
      expect(where.readAt).toMatchObject({ _type: "isNull" });
    });
  });
});
