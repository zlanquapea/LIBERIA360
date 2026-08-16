import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ItinerariesService } from "./itineraries.service";
import { Itinerary } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import { Place } from "../places/entities/place.entity";
import { UsersService } from "../users/users.service";
import { BudgetBand, ItineraryKind } from "./entities/itinerary.enums";

const OWNER_ID = "owner-1";
const COLLABORATOR_ID = "collaborator-1";
const STRANGER_ID = "stranger-1";
const ITINERARY_ID = "trip-1";

function makeItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: ITINERARY_ID,
    userId: OWNER_ID,
    title: "Test Trip",
    kind: ItineraryKind.TRIP,
    durationDays: 2,
    budgetBand: BudgetBand.MODERATE,
    interests: [],
    stops: [{ day: 1, order: 0, placeId: "place-1", notes: null }],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Itinerary;
}

describe("ItinerariesService (collaboration)", () => {
  let service: ItinerariesService;
  let itineraryRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let collaboratorRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let placeRepo: { find: jest.Mock; findOne: jest.Mock };
  let usersService: { findByEmail: jest.Mock };

  beforeEach(async () => {
    itineraryRepo = {
      findOne: jest.fn().mockResolvedValue(makeItinerary()),
      save: jest.fn((data) => data),
      find: jest.fn().mockResolvedValue([]),
    };
    collaboratorRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    placeRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: "place-2", slug: "p2" }),
    };
    usersService = { findByEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItinerariesService,
        { provide: getRepositoryToken(Itinerary), useValue: itineraryRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        {
          provide: getRepositoryToken(ItineraryCollaborator),
          useValue: collaboratorRepo,
        },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(ItinerariesService);
  });

  describe("findOne / view access", () => {
    it("404s for a total stranger (existing owner-only behavior preserved)", async () => {
      await expect(
        service.findOne(STRANGER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets a collaborator view the trip", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      const result = await service.findOne(COLLABORATOR_ID, ITINERARY_ID);
      expect(result.collaborators).toHaveLength(1);
    });
  });

  describe("inviteCollaborator", () => {
    it("404s an unknown itinerary", async () => {
      itineraryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.inviteCollaborator(OWNER_ID, ITINERARY_ID, "x@example.com"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s a collaborator trying to invite someone else onto the trip", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await expect(
        service.inviteCollaborator(
          COLLABORATOR_ID,
          ITINERARY_ID,
          "x@example.com",
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("404s a stranger with no view access at all", async () => {
      await expect(
        service.inviteCollaborator(STRANGER_ID, ITINERARY_ID, "x@example.com"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404s an unknown email", async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.inviteCollaborator(
          OWNER_ID,
          ITINERARY_ID,
          "nobody@example.com",
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects inviting yourself", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: OWNER_ID,
        name: "Owner",
      });
      await expect(
        service.inviteCollaborator(OWNER_ID, ITINERARY_ID, "owner@example.com"),
      ).rejects.toThrow();
    });

    it("rejects a duplicate invite", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: COLLABORATOR_ID,
        name: "Collab",
      });
      collaboratorRepo.findOne.mockResolvedValue({
        id: "existing-row",
        userId: COLLABORATOR_ID,
      });
      await expect(
        service.inviteCollaborator(
          OWNER_ID,
          ITINERARY_ID,
          "collab@example.com",
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("adds the collaborator when the owner invites a real, uninvited user", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: COLLABORATOR_ID,
        name: "Collab",
      });
      await service.inviteCollaborator(
        OWNER_ID,
        ITINERARY_ID,
        "collab@example.com",
      );
      expect(collaboratorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          itineraryId: ITINERARY_ID,
          userId: COLLABORATOR_ID,
          invitedByUserId: OWNER_ID,
        }),
      );
    });
  });

  describe("removeCollaborator", () => {
    it("lets the owner remove anyone", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await service.removeCollaborator(OWNER_ID, ITINERARY_ID, COLLABORATOR_ID);
      expect(collaboratorRepo.delete).toHaveBeenCalledWith({
        itineraryId: ITINERARY_ID,
        userId: COLLABORATOR_ID,
      });
    });

    it("lets a collaborator remove themself", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await service.removeCollaborator(
        COLLABORATOR_ID,
        ITINERARY_ID,
        COLLABORATOR_ID,
      );
      expect(collaboratorRepo.delete).toHaveBeenCalled();
    });

    it("blocks one collaborator from removing another", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
        { userId: "other-collab", user: { id: "other-collab", name: "Other" } },
      ]);
      await expect(
        service.removeCollaborator(
          COLLABORATOR_ID,
          ITINERARY_ID,
          "other-collab",
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("stop mutations", () => {
    it("blocks a non-member from adding a stop", async () => {
      await expect(
        service.addStop(STRANGER_ID, ITINERARY_ID, {
          placeId: "place-2",
          day: 1,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets a collaborator add a stop", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await service.addStop(COLLABORATOR_ID, ITINERARY_ID, {
        placeId: "place-2",
        day: 1,
        notes: "Bring sunscreen",
      });
      expect(itineraryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stops: expect.arrayContaining([
            expect.objectContaining({ placeId: "place-2", day: 1 }),
          ]),
        }),
      );
    });

    it("rejects adding a place that's already on the trip", async () => {
      placeRepo.findOne.mockResolvedValue({ id: "place-1" });
      await expect(
        service.addStop(OWNER_ID, ITINERARY_ID, { placeId: "place-1", day: 1 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("removes a stop", async () => {
      await service.removeStop(OWNER_ID, ITINERARY_ID, "place-1");
      expect(itineraryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ stops: [] }),
      );
    });

    it("404s updating notes on a stop that doesn't exist", async () => {
      await expect(
        service.updateStop(OWNER_ID, ITINERARY_ID, "no-such-place", {
          notes: "hi",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("updates a stop's notes", async () => {
      await service.updateStop(OWNER_ID, ITINERARY_ID, "place-1", {
        notes: "Meet at 9am",
      });
      expect(itineraryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stops: expect.arrayContaining([
            expect.objectContaining({
              placeId: "place-1",
              notes: "Meet at 9am",
            }),
          ]),
        }),
      );
    });
  });
});
