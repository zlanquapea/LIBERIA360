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
import { TripJoinRequest } from "./entities/trip-join-request.entity";
import { Place } from "../places/entities/place.entity";
import { UsersService } from "../users/users.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TripChatService } from "../trip-chat/trip-chat.service";
import { ConfigService } from "@nestjs/config";
import {
  BudgetBand,
  ItineraryKind,
  TripVisibility,
} from "./entities/itinerary.enums";
import { TripJoinRequestStatus } from "./entities/trip-join-request.entity";
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
    destination: null,
    destinationPlaceId: null,
    visibility: TripVisibility.PRIVATE,
    description: null,
    coverImage: null,
    startDate: null,
    endDate: null,
    cancelledAt: null,
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
    create: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let publicTripsQueryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let collaboratorRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  let placeRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let candidatesQueryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };
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
  let joinRequestRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let notificationsService: { create: jest.Mock };
  let tripChatService: { postSystemMessage: jest.Mock };

  beforeEach(async () => {
    publicTripsQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    itineraryRepo = {
      findOne: jest.fn().mockResolvedValue(makeItinerary()),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => publicTripsQueryBuilder),
    };
    collaboratorRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
    };
    candidatesQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([
          { id: "place-1", latitude: 6.3, longitude: -10.8 },
        ]),
    };
    placeRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: "place-2", slug: "p2" }),
      createQueryBuilder: jest.fn(() => candidatesQueryBuilder),
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
    joinRequestRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
    };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    tripChatService = {
      postSystemMessage: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: getRepositoryToken(TripJoinRequest),
          useValue: joinRequestRepo,
        },
        { provide: UsersService, useValue: usersService },
        { provide: MailService, useValue: mailService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: TripChatService, useValue: tripChatService },
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

  describe("renameTrip", () => {
    it("blocks a non-member from renaming", async () => {
      await expect(
        service.renameTrip(STRANGER_ID, ITINERARY_ID, "New title"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets the owner rename the trip", async () => {
      await service.renameTrip(
        OWNER_ID,
        ITINERARY_ID,
        "Mom's 60th birthday trip",
      );
      expect(itineraryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Mom's 60th birthday trip" }),
      );
    });

    it("lets a collaborator rename the trip too", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await service.renameTrip(
        COLLABORATOR_ID,
        ITINERARY_ID,
        "Renamed by collaborator",
      );
      expect(itineraryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Renamed by collaborator" }),
      );
    });
  });

  describe("deleteTrip", () => {
    it("404s an unknown itinerary", async () => {
      itineraryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deleteTrip(OWNER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404s a total stranger (no confirming the id exists)", async () => {
      await expect(
        service.deleteTrip(STRANGER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s a collaborator — only the owner can delete the trip", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await expect(
        service.deleteTrip(COLLABORATOR_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(itineraryRepo.delete).not.toHaveBeenCalled();
    });

    it("lets the owner delete the trip", async () => {
      await service.deleteTrip(OWNER_ID, ITINERARY_ID);
      expect(itineraryRepo.delete).toHaveBeenCalledWith({ id: ITINERARY_ID });
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

  describe("generateTrip — social trip fields", () => {
    const CREATE_DTO = {
      durationDays: 2,
      interests: [],
      budgetBand: BudgetBand.MODERATE,
      title: "Weekend in Robertsport",
      destinationPlaceId: "place-dest",
      visibility: TripVisibility.PUBLIC,
      description: "A relaxed weekend by the coast.",
      coverImage: "cover.jpg",
      startDate: "2026-12-15T00:00:00.000Z",
      endDate: "2026-12-18T00:00:00.000Z",
    };

    beforeEach(() => {
      placeRepo.findOne.mockResolvedValue({
        id: "place-dest",
        images: ["destination.jpg"],
      });
      placeRepo.find.mockResolvedValue([]);
    });

    it("404s when the destination place doesn't exist", async () => {
      placeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.generateTrip(OWNER_ID, CREATE_DTO as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("persists the required name, destination, and visibility", async () => {
      const result = await service.generateTrip(OWNER_ID, CREATE_DTO as never);
      expect(itineraryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Weekend in Robertsport",
          destinationPlaceId: "place-dest",
          visibility: TripVisibility.PUBLIC,
          description: "A relaxed weekend by the coast.",
          coverImage: "cover.jpg",
        }),
      );
      expect(result.destination).toEqual(
        expect.objectContaining({ id: "place-dest" }),
      );
    });
  });

  describe("public trip discovery", () => {
    it("queries only PUBLIC, non-cancelled trips", async () => {
      await service.findPublicTrips({});
      expect(publicTripsQueryBuilder.where).toHaveBeenCalledWith(
        "itinerary.visibility = :visibility",
        { visibility: TripVisibility.PUBLIC },
      );
      expect(publicTripsQueryBuilder.andWhere).toHaveBeenCalledWith(
        "itinerary.cancelledAt IS NULL",
      );
    });

    it("counts the admin themself alongside collaborators", async () => {
      publicTripsQueryBuilder.getManyAndCount.mockResolvedValue([
        [makeItinerary({ visibility: TripVisibility.PUBLIC })],
        1,
      ]);
      collaboratorRepo.count.mockResolvedValue(3);
      const { data } = await service.findPublicTrips({});
      expect(data[0].participantCount).toBe(4);
    });

    it("returns a restricted marker (not a 404) for a real but private trip", async () => {
      itineraryRepo.findOne.mockResolvedValue(
        makeItinerary({ visibility: TripVisibility.PRIVATE }),
      );
      const result = await service.findPublicTripById(ITINERARY_ID);
      expect(result).toEqual({
        id: ITINERARY_ID,
        visibility: TripVisibility.PRIVATE,
      });
    });

    it("404s for a trip that genuinely doesn't exist", async () => {
      itineraryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findPublicTripById("no-such-trip"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns full stop/detail data for a real public trip", async () => {
      itineraryRepo.findOne.mockResolvedValue(
        makeItinerary({ visibility: TripVisibility.PUBLIC }),
      );
      placeRepo.find.mockResolvedValue([{ id: "place-1", name: "Spot" }]);
      const result = await service.findPublicTripById(ITINERARY_ID);
      expect("stops" in result && result.stops).toHaveLength(1);
    });
  });

  describe("join requests", () => {
    it("rejects a request on a private trip", async () => {
      itineraryRepo.findOne.mockResolvedValue(
        makeItinerary({ visibility: TripVisibility.PRIVATE }),
      );
      await expect(
        service.requestToJoin(STRANGER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects the trip owner requesting to join their own trip", async () => {
      itineraryRepo.findOne.mockResolvedValue(
        makeItinerary({ visibility: TripVisibility.PUBLIC }),
      );
      await expect(
        service.requestToJoin(OWNER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects someone who already has a pending request", async () => {
      itineraryRepo.findOne.mockResolvedValue(
        makeItinerary({ visibility: TripVisibility.PUBLIC }),
      );
      joinRequestRepo.findOne.mockResolvedValue({
        status: TripJoinRequestStatus.PENDING,
      });
      await expect(
        service.requestToJoin(STRANGER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("creates a pending request and notifies the trip admin", async () => {
      itineraryRepo.findOne.mockResolvedValue(
        makeItinerary({ visibility: TripVisibility.PUBLIC }),
      );
      const result = await service.requestToJoin(STRANGER_ID, ITINERARY_ID);
      expect(result.status).toBe(TripJoinRequestStatus.PENDING);
      expect(notificationsService.create).toHaveBeenCalledWith(
        OWNER_ID,
        expect.objectContaining({ type: "trip.join_requested" }),
      );
    });

    it("approving materializes a collaborator and notifies the requester", async () => {
      joinRequestRepo.findOne.mockResolvedValue({
        id: "req-1",
        itineraryId: ITINERARY_ID,
        userId: STRANGER_ID,
        status: TripJoinRequestStatus.PENDING,
      });
      await service.approveJoinRequest(OWNER_ID, ITINERARY_ID, "req-1");
      expect(collaboratorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: STRANGER_ID }),
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        STRANGER_ID,
        expect.objectContaining({ type: "trip.join_request_approved" }),
      );
    });

    it("declining never touches collaborators", async () => {
      joinRequestRepo.findOne.mockResolvedValue({
        id: "req-1",
        itineraryId: ITINERARY_ID,
        userId: STRANGER_ID,
        status: TripJoinRequestStatus.PENDING,
      });
      await service.declineJoinRequest(OWNER_ID, ITINERARY_ID, "req-1");
      expect(collaboratorRepo.save).not.toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledWith(
        STRANGER_ID,
        expect.objectContaining({ type: "trip.join_request_declined" }),
      );
    });

    it("rejects approving a request that's already been resolved", async () => {
      joinRequestRepo.findOne.mockResolvedValue({
        id: "req-1",
        itineraryId: ITINERARY_ID,
        userId: STRANGER_ID,
        status: TripJoinRequestStatus.APPROVED,
      });
      await expect(
        service.approveJoinRequest(OWNER_ID, ITINERARY_ID, "req-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("cancelTrip", () => {
    it("404s for a total stranger", async () => {
      await expect(
        service.cancelTrip(STRANGER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("blocks a collaborator (member, but not the owner) from cancelling", async () => {
      collaboratorRepo.find.mockResolvedValue([
        {
          userId: COLLABORATOR_ID,
          user: { id: COLLABORATOR_ID, name: "Collab" },
        },
      ]);
      await expect(
        service.cancelTrip(COLLABORATOR_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("sets cancelledAt for the owner", async () => {
      await service.cancelTrip(OWNER_ID, ITINERARY_ID);
      expect(itineraryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ cancelledAt: expect.any(Date) }),
      );
    });
  });
});
