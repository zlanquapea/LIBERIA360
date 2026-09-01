import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { TripChatService } from "./trip-chat.service";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { TripMessage } from "./entities/trip-message.entity";
import { TripMessageType } from "./entities/trip-message.enums";
import { TripMessageReaction } from "./entities/trip-message-reaction.entity";
import { TripChatReadState } from "./entities/trip-chat-read-state.entity";

const ITINERARY_ID = "trip-1";
const OWNER_ID = "owner-1";
const COLLABORATOR_ID = "collaborator-1";
const STRANGER_ID = "stranger-1";
const MESSAGE_ID = "message-1";

function makeUser(id: string, name: string) {
  return {
    id,
    name,
    email: `${id}@example.com`,
    phone: null,
    authProvider: "email",
    homeCounty: null,
    isAdmin: false,
    isSuperAdmin: false,
    travelerType: null,
    interests: [],
    twoFactorEnabled: false,
    emailVerified: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    passwordHash: "hash",
  };
}

const ITINERARY = { id: ITINERARY_ID, userId: OWNER_ID } as Itinerary;

function makeMessage(overrides: Partial<TripMessage> = {}): TripMessage {
  return {
    id: MESSAGE_ID,
    itineraryId: ITINERARY_ID,
    sender: makeUser(OWNER_ID, "Owner") as never,
    senderUserId: OWNER_ID,
    type: TripMessageType.USER,
    body: "Hello trip!",
    imageUrl: null,
    clientId: null,
    replyToMessage: null,
    replyToMessageId: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    editedAt: null,
    deletedAt: null,
    ...overrides,
  } as TripMessage;
}

describe("TripChatService", () => {
  let service: TripChatService;
  let itineraryRepo: { findOne: jest.Mock };
  let collaboratorRepo: { find: jest.Mock };
  let messageRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let reactionRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
  };
  let readStateRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    take: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(async () => {
    itineraryRepo = { findOne: jest.fn().mockResolvedValue(ITINERARY) };
    collaboratorRepo = {
      find: jest
        .fn()
        .mockResolvedValue([
          { userId: COLLABORATOR_ID } as ItineraryCollaborator,
        ]),
    };
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    messageRepo = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((data) => ({ id: MESSAGE_ID, ...data })),
      create: jest.fn((data) => data),
    };
    reactionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    readStateRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((data) => data),
      create: jest.fn((data) => data),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripChatService,
        { provide: getRepositoryToken(Itinerary), useValue: itineraryRepo },
        {
          provide: getRepositoryToken(ItineraryCollaborator),
          useValue: collaboratorRepo,
        },
        { provide: getRepositoryToken(TripMessage), useValue: messageRepo },
        {
          provide: getRepositoryToken(TripMessageReaction),
          useValue: reactionRepo,
        },
        {
          provide: getRepositoryToken(TripChatReadState),
          useValue: readStateRepo,
        },
      ],
    }).compile();

    service = module.get(TripChatService);
  });

  describe("membership boundary", () => {
    it("404s a genuinely nonexistent trip", async () => {
      itineraryRepo.findOne.mockResolvedValue(null);
      await expect(
        service.listMessages(OWNER_ID, ITINERARY_ID, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("404s a stranger rather than confirming the trip exists", async () => {
      await expect(
        service.listMessages(STRANGER_ID, ITINERARY_ID, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("lets the owner and any collaborator through", async () => {
      await expect(
        service.listMessages(OWNER_ID, ITINERARY_ID, {}),
      ).resolves.toEqual([]);
      await expect(
        service.listMessages(COLLABORATOR_ID, ITINERARY_ID, {}),
      ).resolves.toEqual([]);
    });
  });

  describe("listMessages", () => {
    it("queries oldest-first for the client despite fetching newest-first", async () => {
      const older = makeMessage({
        id: "m-older",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
      });
      const newer = makeMessage({
        id: "m-newer",
        createdAt: new Date("2026-08-02T00:00:00.000Z"),
      });
      // The repo returns them DESC (newest first) — the service must
      // reverse that for the client's chronological rendering.
      queryBuilder.getMany.mockResolvedValue([newer, older]);
      const result = await service.listMessages(OWNER_ID, ITINERARY_ID, {});
      expect(result.map((m) => m.id)).toEqual(["m-older", "m-newer"]);
    });

    it("applies the `before` cursor for paging older history", async () => {
      await service.listMessages(OWNER_ID, ITINERARY_ID, {
        before: "2026-08-15T00:00:00.000Z",
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "message.createdAt < :before",
        { before: new Date("2026-08-15T00:00:00.000Z") },
      );
    });

    it("resolves a reply's immediate parent as a preview", async () => {
      const parent = makeMessage({ id: "m-parent", body: "Original" });
      const reply = makeMessage({
        id: "m-reply",
        replyToMessageId: "m-parent",
        body: "A reply",
      });
      queryBuilder.getMany.mockResolvedValue([reply]);
      messageRepo.find.mockResolvedValue([parent]);
      const [summary] = await service.listMessages(OWNER_ID, ITINERARY_ID, {});
      expect(summary.replyTo).toEqual({
        id: "m-parent",
        senderName: "Owner",
        body: "Original",
        imageUrl: null,
        deleted: false,
      });
    });

    it("shows a deleted quoted message as deleted rather than dropping the reply", async () => {
      const parent = makeMessage({
        id: "m-parent",
        body: "Gone now",
        deletedAt: new Date(),
      });
      const reply = makeMessage({
        id: "m-reply",
        replyToMessageId: "m-parent",
      });
      queryBuilder.getMany.mockResolvedValue([reply]);
      messageRepo.find.mockResolvedValue([parent]);
      const [summary] = await service.listMessages(OWNER_ID, ITINERARY_ID, {});
      expect(summary.replyTo).toMatchObject({ deleted: true, body: null });
    });

    it("redacts body/image/reactions once a message is deleted", async () => {
      const deleted = makeMessage({
        body: "secret",
        imageUrl: "/uploads/x.jpg",
        deletedAt: new Date(),
      });
      queryBuilder.getMany.mockResolvedValue([deleted]);
      reactionRepo.find.mockResolvedValue([
        {
          messageId: MESSAGE_ID,
          userId: COLLABORATOR_ID,
          emoji: "👍",
        } as TripMessageReaction,
      ]);
      const [summary] = await service.listMessages(OWNER_ID, ITINERARY_ID, {});
      expect(summary.body).toBeNull();
      expect(summary.imageUrl).toBeNull();
      expect(summary.reactions).toEqual([]);
    });

    it("aggregates reactions by emoji with counts and reactor ids", async () => {
      const message = makeMessage();
      queryBuilder.getMany.mockResolvedValue([message]);
      reactionRepo.find.mockResolvedValue([
        { messageId: MESSAGE_ID, userId: OWNER_ID, emoji: "👍" },
        { messageId: MESSAGE_ID, userId: COLLABORATOR_ID, emoji: "👍" },
        { messageId: MESSAGE_ID, userId: COLLABORATOR_ID, emoji: "❤️" },
      ] as TripMessageReaction[]);
      const [summary] = await service.listMessages(OWNER_ID, ITINERARY_ID, {});
      expect(summary.reactions).toEqual(
        expect.arrayContaining([
          { emoji: "👍", count: 2, userIds: [OWNER_ID, COLLABORATOR_ID] },
          { emoji: "❤️", count: 1, userIds: [COLLABORATOR_ID] },
        ]),
      );
    });

    describe("delivery status", () => {
      it("is 'sent' when no other member has delivered or read yet", async () => {
        const message = makeMessage({ senderUserId: OWNER_ID });
        queryBuilder.getMany.mockResolvedValue([message]);
        const [summary] = await service.listMessages(
          OWNER_ID,
          ITINERARY_ID,
          {},
        );
        expect(summary.status).toBe("sent");
      });

      it("is 'delivered' once every other member has fetched it but not read it", async () => {
        const message = makeMessage({
          senderUserId: OWNER_ID,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        });
        queryBuilder.getMany.mockResolvedValue([message]);
        readStateRepo.find.mockResolvedValue([
          {
            userId: COLLABORATOR_ID,
            lastDeliveredAt: new Date("2026-08-02T00:00:00.000Z"),
            lastReadAt: null,
          } as TripChatReadState,
        ]);
        const [summary] = await service.listMessages(
          OWNER_ID,
          ITINERARY_ID,
          {},
        );
        expect(summary.status).toBe("delivered");
      });

      it("is 'read' once every other member has read it", async () => {
        const message = makeMessage({
          senderUserId: OWNER_ID,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
        });
        queryBuilder.getMany.mockResolvedValue([message]);
        readStateRepo.find.mockResolvedValue([
          {
            userId: COLLABORATOR_ID,
            lastDeliveredAt: new Date("2026-08-02T00:00:00.000Z"),
            lastReadAt: new Date("2026-08-02T00:00:00.000Z"),
          } as TripChatReadState,
        ]);
        const [summary] = await service.listMessages(
          OWNER_ID,
          ITINERARY_ID,
          {},
        );
        expect(summary.status).toBe("read");
      });
    });
  });

  describe("sendMessage", () => {
    it("rejects a message with neither text nor an image", async () => {
      await expect(
        service.sendMessage(OWNER_ID, ITINERARY_ID, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it("accepts an image-only message", async () => {
      messageRepo.findOneOrFail.mockResolvedValue(
        makeMessage({ body: null, imageUrl: "/uploads/x.jpg" }),
      );
      const result = await service.sendMessage(OWNER_ID, ITINERARY_ID, {
        imageUrl: "/uploads/x.jpg",
      });
      expect(result.imageUrl).toBe("/uploads/x.jpg");
    });

    it("404s a reply to a message from a different trip (or that doesn't exist)", async () => {
      messageRepo.findOne.mockResolvedValue(null);
      await expect(
        service.sendMessage(OWNER_ID, ITINERARY_ID, {
          body: "hi",
          replyToMessageId: "nope",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("persists the sender, body, and echoes clientId back", async () => {
      messageRepo.findOneOrFail.mockResolvedValue(
        makeMessage({ clientId: "local-123" }),
      );
      const result = await service.sendMessage(OWNER_ID, ITINERARY_ID, {
        body: "Hello trip!",
        clientId: "local-123",
      });
      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          itineraryId: ITINERARY_ID,
          senderUserId: OWNER_ID,
          type: TripMessageType.USER,
          body: "Hello trip!",
          clientId: "local-123",
        }),
      );
      expect(result.clientId).toBe("local-123");
    });

    it("advances the sender's own read cursor (sending implies you're caught up)", async () => {
      messageRepo.findOneOrFail.mockResolvedValue(makeMessage());
      await service.sendMessage(OWNER_ID, ITINERARY_ID, { body: "hi" });
      expect(readStateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastReadAt: expect.any(Date) }),
      );
    });
  });

  describe("updateMessage", () => {
    it("rejects editing someone else's message", async () => {
      messageRepo.findOne.mockResolvedValue(
        makeMessage({ senderUserId: COLLABORATOR_ID }),
      );
      await expect(
        service.updateMessage(OWNER_ID, ITINERARY_ID, MESSAGE_ID, {
          body: "edited",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects editing a system message", async () => {
      messageRepo.findOne.mockResolvedValue(
        makeMessage({ type: TripMessageType.SYSTEM, senderUserId: null }),
      );
      await expect(
        service.updateMessage(OWNER_ID, ITINERARY_ID, MESSAGE_ID, {
          body: "edited",
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects editing an already-deleted message", async () => {
      messageRepo.findOne.mockResolvedValue(
        makeMessage({ deletedAt: new Date() }),
      );
      await expect(
        service.updateMessage(OWNER_ID, ITINERARY_ID, MESSAGE_ID, {
          body: "edited",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects editing an image-only message (nothing textual to edit)", async () => {
      messageRepo.findOne.mockResolvedValue(
        makeMessage({ body: null, imageUrl: "/uploads/x.jpg" }),
      );
      await expect(
        service.updateMessage(OWNER_ID, ITINERARY_ID, MESSAGE_ID, {
          body: "caption?",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("updates the body and stamps editedAt for the sender's own text message", async () => {
      const message = makeMessage();
      messageRepo.findOne.mockResolvedValue(message);
      const result = await service.updateMessage(
        OWNER_ID,
        ITINERARY_ID,
        MESSAGE_ID,
        {
          body: "Actually, let's meet at 9am",
        },
      );
      expect(result.body).toBe("Actually, let's meet at 9am");
      expect(result.editedAt).toBeInstanceOf(Date);
    });
  });

  describe("deleteMessage", () => {
    it("rejects deleting someone else's message", async () => {
      messageRepo.findOne.mockResolvedValue(
        makeMessage({ senderUserId: COLLABORATOR_ID }),
      );
      await expect(
        service.deleteMessage(OWNER_ID, ITINERARY_ID, MESSAGE_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("soft-deletes and redacts the sender's own message", async () => {
      const message = makeMessage();
      messageRepo.findOne.mockResolvedValue(message);
      const result = await service.deleteMessage(
        OWNER_ID,
        ITINERARY_ID,
        MESSAGE_ID,
      );
      expect(result.deletedAt).toBeInstanceOf(Date);
      expect(result.body).toBeNull();
    });

    it("is idempotent on an already-deleted message", async () => {
      const message = makeMessage({
        deletedAt: new Date("2026-08-01T00:00:00.000Z"),
      });
      messageRepo.findOne.mockResolvedValue(message);
      await service.deleteMessage(OWNER_ID, ITINERARY_ID, MESSAGE_ID);
      expect(messageRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("toggleReaction", () => {
    it("rejects an emoji outside the allowed set", async () => {
      messageRepo.findOne.mockResolvedValue(makeMessage());
      await expect(
        service.toggleReaction(OWNER_ID, ITINERARY_ID, MESSAGE_ID, "🍕"),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("404s a nonexistent message", async () => {
      messageRepo.findOne.mockResolvedValue(null);
      await expect(
        service.toggleReaction(OWNER_ID, ITINERARY_ID, MESSAGE_ID, "👍"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("adds a reaction that doesn't exist yet", async () => {
      messageRepo.findOne.mockResolvedValue(makeMessage());
      await service.toggleReaction(OWNER_ID, ITINERARY_ID, MESSAGE_ID, "👍");
      expect(reactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: MESSAGE_ID,
          userId: OWNER_ID,
          emoji: "👍",
        }),
      );
      expect(reactionRepo.delete).not.toHaveBeenCalled();
    });

    it("removes the reaction on a second toggle with the same emoji", async () => {
      messageRepo.findOne.mockResolvedValue(makeMessage());
      reactionRepo.findOne.mockResolvedValue({
        id: "reaction-1",
        messageId: MESSAGE_ID,
        userId: OWNER_ID,
        emoji: "👍",
      });
      await service.toggleReaction(OWNER_ID, ITINERARY_ID, MESSAGE_ID, "👍");
      expect(reactionRepo.delete).toHaveBeenCalledWith({ id: "reaction-1" });
      expect(reactionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("markDelivered / markRead", () => {
    it("creates a fresh read-state row for a member with none yet", async () => {
      await service.markDelivered(OWNER_ID, ITINERARY_ID);
      expect(readStateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          itineraryId: ITINERARY_ID,
          userId: OWNER_ID,
          lastDeliveredAt: expect.any(Date),
        }),
      );
    });

    it("never rewinds an already-later timestamp", async () => {
      const future = new Date(Date.now() + 60_000);
      readStateRepo.findOne.mockResolvedValue({
        itineraryId: ITINERARY_ID,
        userId: OWNER_ID,
        lastDeliveredAt: future,
        lastReadAt: null,
      });
      await service.markDelivered(OWNER_ID, ITINERARY_ID);
      expect(readStateRepo.save).not.toHaveBeenCalled();
    });

    it("markRead also advances lastDeliveredAt (reading implies delivered)", async () => {
      await service.markRead(OWNER_ID, ITINERARY_ID);
      expect(readStateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastReadAt: expect.any(Date) }),
      );
      expect(readStateRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastDeliveredAt: expect.any(Date) }),
      );
    });

    it("404s a non-member", async () => {
      await expect(
        service.markRead(STRANGER_ID, ITINERARY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("postSystemMessage", () => {
    it("creates a sender-less SYSTEM message with no membership check", async () => {
      await service.postSystemMessage(ITINERARY_ID, "Alice joined the trip.");
      expect(messageRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          itineraryId: ITINERARY_ID,
          type: TripMessageType.SYSTEM,
          senderUserId: null,
          body: "Alice joined the trip.",
        }),
      );
      expect(itineraryRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
