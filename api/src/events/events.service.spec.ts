import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EventsService } from "./events.service";
import { Event } from "./entities/event.entity";
import { EventRsvp } from "./entities/event-rsvp.entity";
import {
  EventCategory,
  EventReviewStatus,
  EventRsvpStatus,
} from "./entities/event.enums";
import { CreateEventDto } from "./dto/create-event.dto";
import { PushService } from "../push/push.service";
import { UsersService } from "../users/users.service";
import { BusinessesService } from "../businesses/businesses.service";
import { CreatorsService } from "../creators/creators.service";
import { NotificationsService } from "../notifications/notifications.service";

const BASE_DTO: CreateEventDto = {
  name: "Test Event",
  category: EventCategory.CONCERT,
  locationText: "City Hall",
  countyId: "county-1",
  startDate: "2026-09-01T18:00:00Z",
};

describe("EventsService", () => {
  let service: EventsService;
  let eventRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
    merge: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
    wheres: Array<{ sql: string; params: unknown }>;
  };
  let rsvpRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
  };
  let businessesService: { findMine: jest.Mock };
  let creatorsService: { findMine: jest.Mock };
  let usersService: { findIdsByHomeCounty: jest.Mock; findAdminIds: jest.Mock };
  let notificationsService: { create: jest.Mock; createMany: jest.Mock };
  let pushService: { sendToUsers: jest.Mock };

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
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      wheres: [],
    };

    let lastSaved: Record<string, unknown> | null = null;
    eventRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => {
        lastSaved = { id: "event-1", ...data };
        return lastSaved;
      }),
      // Merges in whatever the preceding save() call actually stored (so
      // reviewStatus/etc. set by create()/update() round-trip correctly)
      // while still guaranteeing the county shape notifyNearby needs.
      findOneOrFail: jest.fn((opts) => ({
        countyId: "county-1",
        county: { name: "Montserrado" },
        createdByUserId: "user-1",
        ...lastSaved,
        id: opts.where.id,
      })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      merge: jest.fn((event, patch) => Object.assign(event, patch)),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    rsvpRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => data),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn(),
    };
    businessesService = { findMine: jest.fn().mockResolvedValue([]) };
    creatorsService = { findMine: jest.fn().mockResolvedValue(null) };
    usersService = {
      findIdsByHomeCounty: jest.fn().mockResolvedValue([]),
      findAdminIds: jest.fn().mockResolvedValue([]),
    };
    notificationsService = {
      create: jest.fn(),
      createMany: jest.fn(),
    };
    pushService = { sendToUsers: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        { provide: getRepositoryToken(EventRsvp), useValue: rsvpRepo },
        { provide: PushService, useValue: pushService },
        { provide: UsersService, useValue: usersService },
        { provide: BusinessesService, useValue: businessesService },
        { provide: CreatorsService, useValue: creatorsService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(EventsService);
  });

  describe("posting eligibility", () => {
    it("rejects a plain user with no business, no creator profile, and not an admin", async () => {
      await expect(
        service.create({ id: "user-1", isAdmin: false } as never, BASE_DTO),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventRepo.save).not.toHaveBeenCalled();
    });

    it("allows a business owner", async () => {
      businessesService.findMine.mockResolvedValue([{ id: "biz-1" }]);
      await expect(
        service.create({ id: "user-1", isAdmin: false } as never, BASE_DTO),
      ).resolves.toBeDefined();
    });

    it("allows a creator", async () => {
      creatorsService.findMine.mockResolvedValue({ id: "creator-1" });
      await expect(
        service.create({ id: "user-1", isAdmin: false } as never, BASE_DTO),
      ).resolves.toBeDefined();
    });

    it("allows an admin regardless of business/creator status", async () => {
      await expect(
        service.create({ id: "user-1", isAdmin: true } as never, BASE_DTO),
      ).resolves.toBeDefined();
      // The admin bypass short-circuits before either lookup.
      expect(businessesService.findMine).not.toHaveBeenCalled();
      expect(creatorsService.findMine).not.toHaveBeenCalled();
    });
  });

  describe("review status on create", () => {
    it("starts a self-service event PENDING and notifies admins instead of nearby residents", async () => {
      creatorsService.findMine.mockResolvedValue({ id: "creator-1" });
      const event = await service.create(
        { id: "user-1", isAdmin: false } as never,
        BASE_DTO,
      );
      expect(event.reviewStatus).toBe(EventReviewStatus.PENDING);
      expect(event.reviewedAt).toBeNull();
      expect(notificationsService.createMany).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ type: "admin.event_pending_review" }),
      );
      expect(pushService.sendToUsers).not.toHaveBeenCalled();
    });

    it("auto-approves an admin's own event and notifies nearby residents immediately", async () => {
      usersService.findIdsByHomeCounty.mockResolvedValue(["neighbor-1"]);
      const event = await service.create(
        { id: "admin-1", isAdmin: true } as never,
        BASE_DTO,
      );
      expect(event.reviewStatus).toBe(EventReviewStatus.APPROVED);
      expect(event.reviewedByUserId).toBe("admin-1");
      expect(notificationsService.createMany).not.toHaveBeenCalled();
      expect(pushService.sendToUsers).toHaveBeenCalled();
    });
  });

  describe("validation (runs after the eligibility check)", () => {
    it("still rejects a missing location for an eligible user", async () => {
      creatorsService.findMine.mockResolvedValue({ id: "creator-1" });
      await expect(
        service.create({ id: "user-1", isAdmin: false } as never, {
          ...BASE_DTO,
          locationText: undefined,
        }),
      ).rejects.toBeInstanceOf(Error);
      expect(eventRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("findAll — past-event filtering", () => {
    it("defaults to hiding past events (no dateFrom, no includePast)", async () => {
      await service.findAll({});
      const startDateWhere = queryBuilder.wheres.find((w) =>
        w.sql.includes("event.startDate >= :now"),
      );
      expect(startDateWhere).toBeDefined();
    });

    it("does not add the implicit now-filter when includePast is set", async () => {
      await service.findAll({ includePast: true } as never);
      const startDateWhere = queryBuilder.wheres.find((w) =>
        w.sql.includes("event.startDate >= :now"),
      );
      expect(startDateWhere).toBeUndefined();
    });

    it("does not add the implicit now-filter when dateFrom is given explicitly", async () => {
      await service.findAll({ dateFrom: "2020-01-01" } as never);
      const nowWhere = queryBuilder.wheres.find((w) =>
        w.sql.includes("event.startDate >= :now"),
      );
      const dateFromWhere = queryBuilder.wheres.find((w) =>
        w.sql.includes("event.startDate >= :dateFrom"),
      );
      expect(nowWhere).toBeUndefined();
      expect(dateFromWhere).toBeDefined();
    });
  });

  describe("findMine", () => {
    it("looks up events by createdByUserId, soonest first", async () => {
      await service.findMine("user-1");
      expect(eventRepo.find).toHaveBeenCalledWith({
        where: { createdByUserId: "user-1" },
        order: { startDate: "ASC" },
      });
    });
  });

  describe("update / remove — ownership", () => {
    const existing = {
      id: "event-1",
      createdByUserId: "user-1",
      placeId: null,
      locationText: "City Hall",
      countyId: "county-1",
      startDate: new Date("2026-09-01T18:00:00Z"),
      endDate: null,
    };

    it("lets the organizer update their own event", async () => {
      eventRepo.findOne.mockResolvedValue({ ...existing });
      await expect(
        service.update({ id: "user-1", isAdmin: false } as never, "event-1", {
          name: "Updated name",
        }),
      ).resolves.toBeDefined();
      expect(eventRepo.merge).toHaveBeenCalled();
      expect(eventRepo.save).toHaveBeenCalled();
    });

    it("lets an admin update someone else's event", async () => {
      eventRepo.findOne.mockResolvedValue({ ...existing });
      await expect(
        service.update({ id: "admin-1", isAdmin: true } as never, "event-1", {
          name: "Updated name",
        }),
      ).resolves.toBeDefined();
    });

    it("rejects a non-owner, non-admin with ForbiddenException", async () => {
      eventRepo.findOne.mockResolvedValue({ ...existing });
      await expect(
        service.update({ id: "user-2", isAdmin: false } as never, "event-1", {
          name: "Nope",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventRepo.save).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a nonexistent event id", async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update({ id: "user-1", isAdmin: false } as never, "missing", {
          name: "Nope",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets the organizer remove their own event", async () => {
      eventRepo.findOne.mockResolvedValue({ ...existing });
      await service.remove(
        { id: "user-1", isAdmin: false } as never,
        "event-1",
      );
      expect(eventRepo.delete).toHaveBeenCalledWith({ id: "event-1" });
    });

    it("lets an admin remove someone else's event", async () => {
      eventRepo.findOne.mockResolvedValue({ ...existing });
      await service.remove(
        { id: "admin-1", isAdmin: true } as never,
        "event-1",
      );
      expect(eventRepo.delete).toHaveBeenCalledWith({ id: "event-1" });
    });

    it("rejects a non-owner, non-admin trying to remove", async () => {
      eventRepo.findOne.mockResolvedValue({ ...existing });
      await expect(
        service.remove({ id: "user-2", isAdmin: false } as never, "event-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(eventRepo.delete).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when removing a nonexistent event id", async () => {
      eventRepo.findOne.mockResolvedValue(null);
      await expect(
        service.remove({ id: "user-1", isAdmin: false } as never, "missing"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("RSVP", () => {
    it("marks a first-time viewer Interested and increments the count", async () => {
      eventRepo.findOne.mockResolvedValue({
        id: "event-1",
        interestedCount: 0,
        goingCount: 0,
      });
      rsvpRepo.findOne.mockResolvedValue(null);

      const result = await service.setRsvp(
        "user-1",
        "event-1",
        EventRsvpStatus.INTERESTED,
      );

      expect(rsvpRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "event-1",
          userId: "user-1",
          status: EventRsvpStatus.INTERESTED,
        }),
      );
      expect(result).toEqual({
        status: EventRsvpStatus.INTERESTED,
        interestedCount: 1,
        goingCount: 0,
      });
    });

    it("switches Interested to Going, moving the count across rather than accumulating both", async () => {
      eventRepo.findOne.mockResolvedValue({
        id: "event-1",
        interestedCount: 1,
        goingCount: 0,
      });
      const existing = { status: EventRsvpStatus.INTERESTED };
      rsvpRepo.findOne.mockResolvedValue(existing);

      const result = await service.setRsvp(
        "user-1",
        "event-1",
        EventRsvpStatus.GOING,
      );

      expect(existing.status).toBe(EventRsvpStatus.GOING);
      expect(rsvpRepo.save).toHaveBeenCalledWith(existing);
      expect(result).toEqual({
        status: EventRsvpStatus.GOING,
        interestedCount: 0,
        goingCount: 1,
      });
    });

    it("setting the status the viewer already has is a no-op", async () => {
      eventRepo.findOne.mockResolvedValue({
        id: "event-1",
        interestedCount: 1,
        goingCount: 0,
      });
      rsvpRepo.findOne.mockResolvedValue({
        status: EventRsvpStatus.INTERESTED,
      });

      const result = await service.setRsvp(
        "user-1",
        "event-1",
        EventRsvpStatus.INTERESTED,
      );

      expect(rsvpRepo.save).not.toHaveBeenCalled();
      expect(eventRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({
        status: EventRsvpStatus.INTERESTED,
        interestedCount: 1,
        goingCount: 0,
      });
    });

    it("removeRsvp clears the row and decrements the matching count", async () => {
      eventRepo.findOne.mockResolvedValue({
        id: "event-1",
        interestedCount: 0,
        goingCount: 1,
      });
      const existing = { status: EventRsvpStatus.GOING };
      rsvpRepo.findOne.mockResolvedValue(existing);

      const result = await service.removeRsvp("user-1", "event-1");

      expect(rsvpRepo.remove).toHaveBeenCalledWith(existing);
      expect(result).toEqual({ interestedCount: 0, goingCount: 0 });
    });

    it("removeRsvp is a no-op when the viewer never RSVP'd", async () => {
      eventRepo.findOne.mockResolvedValue({
        id: "event-1",
        interestedCount: 0,
        goingCount: 0,
      });
      rsvpRepo.findOne.mockResolvedValue(null);

      const result = await service.removeRsvp("user-1", "event-1");

      expect(rsvpRepo.remove).not.toHaveBeenCalled();
      expect(eventRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({ interestedCount: 0, goingCount: 0 });
    });

    it("getViewerRsvp returns null when the viewer hasn't RSVP'd", async () => {
      rsvpRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getViewerRsvp("user-1", "event-1"),
      ).resolves.toBeNull();
    });

    it("getViewerRsvp returns the stored status", async () => {
      rsvpRepo.findOne.mockResolvedValue({ status: EventRsvpStatus.GOING });
      await expect(service.getViewerRsvp("user-1", "event-1")).resolves.toBe(
        EventRsvpStatus.GOING,
      );
    });

    it("getGoingAttendees maps rows to plain id/name, newest first", async () => {
      rsvpRepo.find.mockResolvedValue([
        { user: { id: "u1", name: "Alice" } },
        { user: { id: "u2", name: "Bob" } },
      ]);

      await expect(service.getGoingAttendees("event-1")).resolves.toEqual([
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ]);
      expect(rsvpRepo.find).toHaveBeenCalledWith({
        where: { eventId: "event-1", status: EventRsvpStatus.GOING },
        relations: ["user"],
        order: { createdAt: "DESC" },
        take: 6,
      });
    });
  });
});
