import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FoodOrderMessagesService } from "./food-order-messages.service";
import { FoodOrderMessage } from "./entities/food-order-message.entity";
import { FoodOrder } from "../food-orders/entities/food-order.entity";
import { NotificationsService } from "../notifications/notifications.service";

const BUYER_ID = "buyer-1";
const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const ORDER_ID = "order-1";

const ORDER = {
  id: ORDER_ID,
  buyerUserId: BUYER_ID,
  business: { ownerUserId: OWNER_ID },
};

describe("FoodOrderMessagesService", () => {
  let service: FoodOrderMessagesService;
  let messageRepo: {
    find: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    findOneOrFail: jest.Mock;
    update: jest.Mock;
  };
  let orderRepo: { findOne: jest.Mock };
  let notificationsService: { create: jest.Mock };

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
    orderRepo = {
      findOne: jest.fn().mockResolvedValue(ORDER),
    };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodOrderMessagesService,
        {
          provide: getRepositoryToken(FoodOrderMessage),
          useValue: messageRepo,
        },
        { provide: getRepositoryToken(FoodOrder), useValue: orderRepo },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get(FoodOrderMessagesService);
  });

  it("rejects posting to an order that doesn't exist", async () => {
    orderRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create(BUYER_ID, ORDER_ID, { body: "hi" }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a user who is neither the buyer nor the restaurant owner", async () => {
    await expect(
      service.create(STRANGER_ID, ORDER_ID, { body: "hi" }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it("lets the buyer post a message and notifies the owner", async () => {
    const result = await service.create(BUYER_ID, ORDER_ID, {
      body: "Can I add extra pepper?",
    });
    expect(result).toMatchObject({
      orderId: ORDER_ID,
      senderUserId: BUYER_ID,
      body: "Can I add extra pepper?",
    });
    expect(notificationsService.create).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({
        type: "food_order_message.received",
        body: "Can I add extra pepper?",
      }),
    );
  });

  it("lets the restaurant owner post a message and notifies the buyer", async () => {
    await service.create(OWNER_ID, ORDER_ID, { body: "Ready in 20 minutes." });
    expect(notificationsService.create).toHaveBeenCalledWith(
      BUYER_ID,
      expect.objectContaining({
        type: "food_order_message.received",
        body: "Ready in 20 minutes.",
      }),
    );
  });

  it("rejects a stranger reading the thread", async () => {
    await expect(
      service.findForOrder(STRANGER_ID, ORDER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns the thread ordered oldest-first for a participant", async () => {
    await service.findForOrder(BUYER_ID, ORDER_ID);
    expect(messageRepo.find).toHaveBeenCalledWith({
      where: { orderId: ORDER_ID },
      order: { createdAt: "ASC" },
    });
  });

  describe("markRead", () => {
    it("rejects a stranger", async () => {
      await expect(
        service.markRead(STRANGER_ID, ORDER_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(messageRepo.update).not.toHaveBeenCalled();
    });

    it("marks only the other participant's unread messages as read", async () => {
      await service.markRead(OWNER_ID, ORDER_ID);
      expect(messageRepo.update).toHaveBeenCalledTimes(1);
      const [where, patch] = messageRepo.update.mock.calls[0];
      expect(where).toMatchObject({ orderId: ORDER_ID });
      expect(patch.readAt).toBeInstanceOf(Date);
      expect(where.senderUserId).toMatchObject({
        _type: "not",
        _value: OWNER_ID,
      });
      expect(where.readAt).toMatchObject({ _type: "isNull" });
    });
  });
});
