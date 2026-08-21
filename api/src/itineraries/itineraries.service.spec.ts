import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ItinerariesService } from "./itineraries.service";
import { Itinerary } from "./entities/itinerary.entity";
import { ItineraryCollaborator } from "./entities/itinerary-collaborator.entity";
import {
  TripInvitation,
  TripInvitationStatus,
} from "./entities/trip-invitation.entity";
import { Place } from "../places/entities/place.entity";
import { UsersService } from "../users/users.service";
import { MailService } from "../mail/mail.service";
import { ConfigService } from "@nestjs/config";
import { BudgetBand, ItineraryKind } from "./entities/itinerary.enums";
import { hashToken } from "../auth/token-hash";

// Every accept/decline/preview test below calls the service with the
// plaintext token "token" — the mocked invitation row's tokenHash needs
// to be its real SHA-256 hash (see findInvitationByToken's hashesMatch
// check), not an arbitrary string, or every one of those calls 404s.
const TEST_TOKEN = "token";
const TEST_TOKEN_HASH = hashToken(TEST_TOKEN);

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

function makeInvitation(
  overrides: Partial<TripInvitation> = {},
): TripInvitation {
  return {
    id: "invite-1",
    itineraryId: ITINERARY_ID,
    invitedByUserId: OWNER_ID,
    email: "invitee@example.com",
    inviteeUserId: null,
    tokenHash: TEST_TOKEN_HASH,
    status: TripInvitationStatus.PENDING,
    viewedAt: null,
    respondedAt: null,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    emailDelivered: false,
    createdAt: new Date(),
    ...overrides,
  } as TripInvitation;
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
  let invitationRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    searchByNameOrEmail: jest.Mock;
  };
  let mailService: {
    sendTripInvitation: jest.Mock;
    sendInvitationAccepted: jest.Mock;
  };

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
    invitationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    usersService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      searchByNameOrEmail: jest.fn().mockResolvedValue([]),
    };
    mailService = {
      sendTripInvitation: jest.fn().mockResolvedValue(true),
      sendInvitationAccepted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItinerariesService,
        { provide: getRepositoryToken(Itinerary), useValue: itineraryRepo },
        { provide: getRepositoryToken(Place), useValue: placeRepo },
        {
          provide: getRepositoryToken(ItineraryCollaborator),
          useValue: collaboratorRepo,
        },
        {
          provide: getRepositoryToken(TripInvitation),
          useValue: invitationRepo,
        },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue("https://liberia360.example"),
          },
        },
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

  describe("createInvitations", () => {
    it("404s an unknown itinerary", async () => {
      itineraryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createInvitations(OWNER_ID, ITINERARY_ID, [
          { email: "x@example.com" },
        ]),
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
        service.createInvitations(COLLABORATOR_ID, ITINERARY_ID, [
          { email: "x@example.com" },
        ]),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("404s a stranger with no view access at all", async () => {
      await expect(
        service.createInvitations(STRANGER_ID, ITINERARY_ID, [
          { email: "x@example.com" },
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("400s an invitee with neither userId nor email", async () => {
      await expect(
        service.createInvitations(OWNER_ID, ITINERARY_ID, [{}]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("404s an unknown userId pick", async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(
        service.createInvitations(OWNER_ID, ITINERARY_ID, [
          { userId: "ghost" },
        ]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects inviting yourself", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: OWNER_ID,
        name: "Owner",
        email: "owner@example.com",
      });
      await expect(
        service.createInvitations(OWNER_ID, ITINERARY_ID, [
          { email: "owner@example.com" },
        ]),
      ).rejects.toThrow();
    });

    it("rejects inviting someone already a confirmed collaborator", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: COLLABORATOR_ID,
        name: "Collab",
        email: "collab@example.com",
      });
      collaboratorRepo.findOne.mockResolvedValue({
        id: "existing-row",
        userId: COLLABORATOR_ID,
      });
      await expect(
        service.createInvitations(OWNER_ID, ITINERARY_ID, [
          { email: "collab@example.com" },
        ]),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects re-inviting someone whose invitation is already accepted", async () => {
      invitationRepo.findOne.mockResolvedValue(
        makeInvitation({ status: TripInvitationStatus.ACCEPTED }),
      );
      await expect(
        service.createInvitations(OWNER_ID, ITINERARY_ID, [
          { email: "invitee@example.com" },
        ]),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("creates a pending invitation for a known user and emails them", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: COLLABORATOR_ID,
        name: "Collab",
        email: "collab@example.com",
      });
      usersService.findById.mockResolvedValue({
        id: OWNER_ID,
        name: "Owner",
        email: "owner@example.com",
      });
      await service.createInvitations(OWNER_ID, ITINERARY_ID, [
        { email: "collab@example.com" },
      ]);
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          itineraryId: ITINERARY_ID,
          invitedByUserId: OWNER_ID,
          email: "collab@example.com",
          inviteeUserId: COLLABORATOR_ID,
        }),
      );
      expect(mailService.sendTripInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ to: "collab@example.com", hasAccount: true }),
      );
    });

    it("creates an invitation for a bare email with no account yet", async () => {
      usersService.findById.mockResolvedValue({
        id: OWNER_ID,
        name: "Owner",
        email: "owner@example.com",
      });
      await service.createInvitations(OWNER_ID, ITINERARY_ID, [
        { email: "nobody@example.com" },
      ]);
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "nobody@example.com",
          inviteeUserId: null,
        }),
      );
      expect(mailService.sendTripInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "nobody@example.com",
          hasAccount: false,
        }),
      );
    });

    it("resends by resetting an existing declined invitation instead of duplicating it", async () => {
      const declined = makeInvitation({
        status: TripInvitationStatus.DECLINED,
      });
      invitationRepo.findOne.mockResolvedValue(declined);
      await service.createInvitations(OWNER_ID, ITINERARY_ID, [
        { email: "invitee@example.com" },
      ]);
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "invite-1",
          status: TripInvitationStatus.PENDING,
        }),
      );
    });
  });

  describe("searchInvitablePeople", () => {
    it("owner-only", async () => {
      await expect(
        service.searchInvitablePeople(STRANGER_ID, ITINERARY_ID, "jo"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("excludes existing collaborators and pending invitees from results", async () => {
      usersService.searchByNameOrEmail.mockResolvedValue([
        { id: COLLABORATOR_ID, name: "Collab", email: "collab@example.com" },
        { id: "fresh-1", name: "Fresh", email: "fresh@example.com" },
      ]);
      collaboratorRepo.find.mockResolvedValue([{ userId: COLLABORATOR_ID }]);
      const results = await service.searchInvitablePeople(
        OWNER_ID,
        ITINERARY_ID,
        "example",
      );
      expect(results.map((r) => r.id)).toEqual(["fresh-1"]);
      expect(results[0].maskedEmail).not.toContain("fresh@example.com");
    });
  });

  describe("resendInvitation / cancelInvitation", () => {
    it("only resends a pending invitation", async () => {
      invitationRepo.findOne.mockResolvedValue(
        makeInvitation({ status: TripInvitationStatus.ACCEPTED }),
      );
      await expect(
        service.resendInvitation(OWNER_ID, ITINERARY_ID, "invite-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("resends a pending invitation with a fresh token and expiry", async () => {
      const pending = makeInvitation();
      invitationRepo.findOne.mockResolvedValue(pending);
      await service.resendInvitation(OWNER_ID, ITINERARY_ID, "invite-1");
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ viewedAt: null }),
      );
      expect(mailService.sendTripInvitation).toHaveBeenCalled();
    });

    it("cancels an invitation outright", async () => {
      await service.cancelInvitation(OWNER_ID, ITINERARY_ID, "invite-1");
      expect(invitationRepo.delete).toHaveBeenCalledWith({
        id: "invite-1",
        itineraryId: ITINERARY_ID,
      });
    });
  });

  describe("invitation preview / accept / decline", () => {
    it("404s an unknown token", async () => {
      invitationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getInvitationPreview("bad-token"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("marks a pending invitation viewed on first preview", async () => {
      invitationRepo.findOne.mockResolvedValue(makeInvitation());
      await service.getInvitationPreview(TEST_TOKEN);
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ viewedAt: expect.any(Date) }),
      );
    });

    it("accept fails once already responded", async () => {
      invitationRepo.findOne.mockResolvedValue(
        makeInvitation({ status: TripInvitationStatus.DECLINED }),
      );
      await expect(
        service.acceptByToken(COLLABORATOR_ID, "token"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("accept fails once expired", async () => {
      invitationRepo.findOne.mockResolvedValue(
        makeInvitation({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(
        service.acceptByToken(COLLABORATOR_ID, "token"),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("403s a different account than the one this invitation targets", async () => {
      invitationRepo.findOne.mockResolvedValue(
        makeInvitation({ inviteeUserId: "someone-else" }),
      );
      await expect(
        service.acceptByToken(COLLABORATOR_ID, "token"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("accepting adds a collaborator row and notifies the organizer", async () => {
      invitationRepo.findOne.mockResolvedValue(makeInvitation());
      usersService.findById.mockImplementation((id: string) =>
        Promise.resolve({ id, name: id, email: `${id}@example.com` }),
      );
      // The final findOne(...) re-check after accepting re-lists
      // collaborators — a real DB would reflect the row just saved, so
      // the mock needs to too.
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await service.acceptByToken(COLLABORATOR_ID, "token");
      expect(collaboratorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          itineraryId: ITINERARY_ID,
          userId: COLLABORATOR_ID,
        }),
      );
      expect(mailService.sendInvitationAccepted).toHaveBeenCalled();
    });

    it("declining marks the invitation declined without adding a collaborator", async () => {
      invitationRepo.findOne.mockResolvedValue(makeInvitation());
      await service.declineByToken(COLLABORATOR_ID, "token");
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TripInvitationStatus.DECLINED }),
      );
      expect(collaboratorRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("linkInvitationToNewAccount", () => {
    it("silently no-ops for an unknown token", async () => {
      invitationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.linkInvitationToNewAccount("bad-token", "new-user"),
      ).resolves.toBeUndefined();
      expect(invitationRepo.save).not.toHaveBeenCalled();
    });

    it("links a still-pending, unclaimed invitation to the new account", async () => {
      invitationRepo.findOne.mockResolvedValue(makeInvitation());
      await service.linkInvitationToNewAccount("token", "new-user");
      expect(invitationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ inviteeUserId: "new-user" }),
      );
    });

    it("refuses to hijack an invitation already claimed by a different account", async () => {
      invitationRepo.findOne.mockResolvedValue(
        makeInvitation({ inviteeUserId: "already-claimed" }),
      );
      await service.linkInvitationToNewAccount("token", "attacker");
      expect(invitationRepo.save).not.toHaveBeenCalled();
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
