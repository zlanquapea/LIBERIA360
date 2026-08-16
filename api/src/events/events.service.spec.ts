import { ForbiddenException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { EventsService } from "./events.service";
import { Event } from "./entities/event.entity";
import { EventCategory } from "./entities/event.enums";
import { CreateEventDto } from "./dto/create-event.dto";
import { PushService } from "../push/push.service";
import { UsersService } from "../users/users.service";
import { BusinessesService } from "../businesses/businesses.service";
import { CreatorsService } from "../creators/creators.service";

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
  };
  let businessesService: { findMine: jest.Mock };
  let creatorsService: { findMine: jest.Mock };

  beforeEach(async () => {
    eventRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: "event-1", ...data })),
      findOneOrFail: jest.fn((opts) => ({
        id: opts.where.id,
        countyId: "county-1",
        county: { name: "Montserrado" },
        createdByUserId: "user-1",
      })),
    };
    businessesService = { findMine: jest.fn().mockResolvedValue([]) };
    creatorsService = { findMine: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(Event), useValue: eventRepo },
        {
          provide: PushService,
          useValue: { sendToUsers: jest.fn() },
        },
        {
          provide: UsersService,
          useValue: { findIdsByHomeCounty: jest.fn().mockResolvedValue([]) },
        },
        { provide: BusinessesService, useValue: businessesService },
        { provide: CreatorsService, useValue: creatorsService },
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
});
