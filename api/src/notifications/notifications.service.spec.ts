import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotificationsService } from "./notifications.service";
import { Notification } from "./entities/notification.entity";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let repo: {
    save: jest.Mock;
    create: jest.Mock;
    findAndCount: jest.Mock;
    count: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      save: jest.fn((data) => Promise.resolve(data)),
      create: jest.fn((data) => data),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe("create", () => {
    it("saves a notification for the given user", async () => {
      await service.create("user-1", {
        type: "booking.requested",
        title: "New booking request",
        body: "Someone requested a booking.",
        link: "/account/bookings",
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          type: "booking.requested",
          title: "New booking request",
          link: "/account/bookings",
        }),
      );
    });

    it("defaults link to null when not given", async () => {
      await service.create("user-1", {
        type: "booking.confirmed",
        title: "Booking confirmed",
        body: "Your booking was confirmed.",
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ link: null }),
      );
    });

    it("swallows a save failure instead of throwing — a notification hiccup should never fail the real action that triggered it", async () => {
      repo.save.mockRejectedValue(new Error("connection reset"));
      await expect(
        service.create("user-1", {
          type: "booking.requested",
          title: "New booking request",
          body: "Someone requested a booking.",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("createMany", () => {
    it("saves one row per recipient", async () => {
      await service.createMany(["admin-1", "admin-2"], {
        type: "admin.place_pending_review",
        title: "New place pending review",
        body: "A place needs review.",
      });
      expect(repo.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: "admin-1" }),
        expect.objectContaining({ userId: "admin-2" }),
      ]);
    });

    it("is a no-op for an empty recipient list", async () => {
      await service.createMany([], {
        type: "admin.place_pending_review",
        title: "New place pending review",
        body: "A place needs review.",
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("swallows a save failure instead of throwing", async () => {
      repo.save.mockRejectedValue(new Error("connection reset"));
      await expect(
        service.createMany(["admin-1"], {
          type: "admin.place_pending_review",
          title: "New place pending review",
          body: "A place needs review.",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("findForUser", () => {
    it("paginates using the given page/limit, ordered by createdAt DESC", async () => {
      repo.findAndCount.mockResolvedValue([[{ id: "n1" }], 45]);
      const result = await service.findForUser("user-1", {
        page: 2,
        limit: 20,
      });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        order: { createdAt: "DESC" },
        skip: 20,
        take: 20,
      });
      expect(result.meta).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
    });

    it("filters to unread only when unreadOnly is true", async () => {
      await service.findForUser("user-1", { unreadOnly: true });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1", read: false } }),
      );
    });
  });

  describe("getUnreadCount", () => {
    it("counts only unread notifications for the given user", async () => {
      repo.count.mockResolvedValue(3);
      const count = await service.getUnreadCount("user-1");
      expect(count).toBe(3);
      expect(repo.count).toHaveBeenCalledWith({
        where: { userId: "user-1", read: false },
      });
    });
  });

  describe("markRead", () => {
    it("rejects an unknown notification", async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.markRead("user-1", "nonexistent"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects marking another user's notification read", async () => {
      repo.findOne.mockResolvedValue({
        id: "n1",
        userId: "other-user",
        read: false,
      });
      await expect(service.markRead("user-1", "n1")).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("marks an unread notification read", async () => {
      repo.findOne.mockResolvedValue({
        id: "n1",
        userId: "user-1",
        read: false,
      });
      const result = await service.markRead("user-1", "n1");
      expect(result.read).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ read: true }),
      );
    });

    it("is a no-op save when already read", async () => {
      repo.findOne.mockResolvedValue({
        id: "n1",
        userId: "user-1",
        read: true,
      });
      await service.markRead("user-1", "n1");
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe("markAllRead", () => {
    it("marks every unread notification for the user as read", async () => {
      await service.markAllRead("user-1");
      expect(repo.update).toHaveBeenCalledWith(
        { userId: "user-1", read: false },
        { read: true },
      );
    });
  });
});
