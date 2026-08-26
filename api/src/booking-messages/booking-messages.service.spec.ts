import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BookingMessagesService } from "./booking-messages.service";
import { BookingMessage } from "./entities/booking-message.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { NotificationsService } from "../notifications/notifications.service";

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
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOneOrFail: jest.Mock;
    update: jest.Mock;
  };
  let bookingRepo: { findOne: jest.Mock };
  let notificationsService: { create: jest.Mock };

  beforeEach(async () => {
    let saved: Record<string, unknown> = {};
    messageRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
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
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingMessagesService,
        { provide: getRepositoryToken(BookingMessage), useValue: messageRepo },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: NotificationsService, useValue: notificationsService },
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

  it("notifies the owner when the guest posts a message", async () => {
    await service.create(GUEST_ID, BOOKING_ID, {
      body: "What time is check-in?",
    });
    expect(notificationsService.create).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({
        type: "booking_message.received",
        body: "What time is check-in?",
      }),
    );
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

  it("notifies the guest when the owner posts a message", async () => {
    await service.create(OWNER_ID, BOOKING_ID, {
      body: "Check-in is at 2pm.",
    });
    expect(notificationsService.create).toHaveBeenCalledWith(
      GUEST_ID,
      expect.objectContaining({
        type: "booking_message.received",
        body: "Check-in is at 2pm.",
      }),
    );
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

  describe("update", () => {
    it("rejects a stranger", async () => {
      await expect(
        service.update(STRANGER_ID, BOOKING_ID, "message-1", { body: "hi" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws NotFoundException when the message doesn't exist on this booking", async () => {
      messageRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(GUEST_ID, BOOKING_ID, "missing", { body: "hi" }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects editing someone else's message", async () => {
      messageRepo.findOne.mockResolvedValue({
        id: "message-1",
        bookingId: BOOKING_ID,
        senderUserId: GUEST_ID,
        body: "original",
        deletedAt: null,
      });
      await expect(
        service.update(OWNER_ID, BOOKING_ID, "message-1", { body: "hacked" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it("rejects editing a deleted message", async () => {
      messageRepo.findOne.mockResolvedValue({
        id: "message-1",
        bookingId: BOOKING_ID,
        senderUserId: GUEST_ID,
        body: "original",
        deletedAt: new Date(),
      });
      await expect(
        service.update(GUEST_ID, BOOKING_ID, "message-1", { body: "edit" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("updates the body and stamps editedAt for the sender", async () => {
      messageRepo.findOne.mockResolvedValue({
        id: "message-1",
        bookingId: BOOKING_ID,
        senderUserId: GUEST_ID,
        body: "original",
        deletedAt: null,
      });
      const result = await service.update(GUEST_ID, BOOKING_ID, "message-1", {
        body: "corrected",
      });
      expect(result).toMatchObject({ body: "corrected" });
      expect(result.editedAt).toBeInstanceOf(Date);
    });
  });

  describe("remove", () => {
    it("rejects a stranger", async () => {
      await expect(
        service.remove(STRANGER_ID, BOOKING_ID, "message-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects deleting someone else's message", async () => {
      messageRepo.findOne.mockResolvedValue({
        id: "message-1",
        bookingId: BOOKING_ID,
        senderUserId: OWNER_ID,
        deletedAt: null,
      });
      await expect(
        service.remove(GUEST_ID, BOOKING_ID, "message-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it("soft-deletes the sender's own message", async () => {
      const message = {
        id: "message-1",
        bookingId: BOOKING_ID,
        senderUserId: GUEST_ID,
        deletedAt: null,
      };
      messageRepo.findOne.mockResolvedValue(message);
      await service.remove(GUEST_ID, BOOKING_ID, "message-1");
      expect(messageRepo.save).toHaveBeenCalledTimes(1);
      expect(message.deletedAt).toBeInstanceOf(Date);
    });

    it("is a no-op for an already-deleted message", async () => {
      messageRepo.findOne.mockResolvedValue({
        id: "message-1",
        bookingId: BOOKING_ID,
        senderUserId: GUEST_ID,
        deletedAt: new Date(),
      });
      await service.remove(GUEST_ID, BOOKING_ID, "message-1");
      expect(messageRepo.save).not.toHaveBeenCalled();
    });
  });
});
