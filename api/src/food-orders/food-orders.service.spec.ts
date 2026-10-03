import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { FoodOrdersService } from "./food-orders.service";
import { FoodOrder } from "./entities/food-order.entity";
import {
  FoodFulfillment,
  FoodOrderStatus,
  FoodPaymentMethod,
  FoodPaymentStatus,
} from "./entities/food-order.enums";
import { Business } from "../businesses/entities/business.entity";
import {
  BusinessReviewStatus,
  BusinessType,
} from "../businesses/entities/business.enums";
import { MenuItem } from "../menu-items/entities/menu-item.entity";
import { NotificationsService } from "../notifications/notifications.service";
import { MenuItemsService } from "../menu-items/menu-items.service";

const BUYER_ID = "buyer-1";
const OWNER_ID = "owner-1";
const BUSINESS_ID = "business-1";

const SETTINGS = {
  businessId: BUSINESS_ID,
  currency: "USD",
  pickupEnabled: true,
  deliveryEnabled: true,
  deliveryFee: 2,
  freeDeliveryMinimum: 25,
  deliveryAreas: null,
  deliveryEstimate: null,
  cashEnabled: true,
  mtnMomoNumber: null,
  orangeMoneyNumber: "0777 123 456",
  mobileMoneyName: "Mama's Kitchen",
};

function approvedRestaurant(overrides: Partial<Business> = {}): Business {
  return {
    id: BUSINESS_ID,
    name: "Mama's Kitchen",
    type: BusinessType.RESTAURANT,
    reviewStatus: BusinessReviewStatus.APPROVED,
    ownerUserId: OWNER_ID,
    ...overrides,
  } as Business;
}

function menuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "item-1",
    businessId: BUSINESS_ID,
    name: "Jollof Rice",
    price: 10,
    isAvailable: true,
    ...overrides,
  } as MenuItem;
}

describe("FoodOrdersService", () => {
  let service: FoodOrdersService;
  let orderRepo: {
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let businessRepo: { findOne: jest.Mock };
  let menuItemRepo: { find: jest.Mock };
  let notificationsService: { create: jest.Mock };
  let menuItemsService: { getSettings: jest.Mock };

  beforeEach(async () => {
    let saved: Record<string, unknown> = {};
    orderRepo = {
      findOne: jest.fn(() => saved),
      findOneOrFail: jest.fn(() => saved),
      save: jest.fn((data) => {
        saved = {
          id: saved.id ?? "order-1",
          buyer: { name: "Alice" },
          ...data,
        };
        return saved;
      }),
      create: jest.fn((data) => data),
      find: jest.fn().mockResolvedValue([]),
    };
    businessRepo = {
      findOne: jest.fn().mockResolvedValue(approvedRestaurant()),
    };
    menuItemRepo = { find: jest.fn().mockResolvedValue([menuItem()]) };
    notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
    menuItemsService = {
      getSettings: jest.fn().mockResolvedValue(SETTINGS),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodOrdersService,
        { provide: getRepositoryToken(FoodOrder), useValue: orderRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: MenuItemsService, useValue: menuItemsService },
      ],
    }).compile();

    service = module.get(FoodOrdersService);
  });

  describe("create", () => {
    it("rejects an order against a business that doesn't exist", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("rejects an order against a non-restaurant business", async () => {
      businessRepo.findOne.mockResolvedValue(
        approvedRestaurant({ type: BusinessType.HOTEL }),
      );
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an order against a business that isn't approved yet", async () => {
      businessRepo.findOne.mockResolvedValue(
        approvedRestaurant({
          reviewStatus: BusinessReviewStatus.SUBMITTED_FOR_REVIEW,
        }),
      );
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a menu item that doesn't belong to this business", async () => {
      menuItemRepo.find.mockResolvedValue([]);
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "not-on-menu", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a sold-out menu item", async () => {
      menuItemRepo.find.mockResolvedValue([menuItem({ isAvailable: false })]);
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("never trusts a client-submitted price — snapshots the live menu price", async () => {
      menuItemRepo.find.mockResolvedValue([menuItem({ price: 15 })]);
      const order = await service.create(BUYER_ID, BUSINESS_ID, {
        items: [{ menuItemId: "item-1", quantity: 2 }],
      });
      expect(order.items).toEqual([
        {
          menuItemId: "item-1",
          name: "Jollof Rice",
          unitPrice: "15.00",
          quantity: 2,
          options: [],
        },
      ]);
      expect(order.totalAmount).toBe(30);
    });

    it("lets a bar take orders", async () => {
      businessRepo.findOne.mockResolvedValue(
        approvedRestaurant({ type: BusinessType.BAR }),
      );
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).resolves.toEqual(expect.objectContaining({ totalAmount: 10 }));
    });

    it("prices chosen options from the live menu and snapshots them", async () => {
      menuItemRepo.find.mockResolvedValue([
        menuItem({
          optionGroups: [
            {
              id: "size",
              name: "Size",
              required: true,
              maxSelections: 1,
              choices: [
                { id: "reg", name: "Regular", priceDelta: 0 },
                { id: "lg", name: "Large", priceDelta: 2.5 },
              ],
            },
          ],
        }),
      ]);
      const order = await service.create(BUYER_ID, BUSINESS_ID, {
        items: [
          {
            menuItemId: "item-1",
            quantity: 2,
            selections: [{ groupId: "size", choiceIds: ["lg"] }],
          },
        ],
      });
      expect(order.items[0]).toEqual(
        expect.objectContaining({
          unitPrice: "12.50",
          options: [{ group: "Size", choice: "Large", priceDelta: "2.50" }],
        }),
      );
      expect(order.totalAmount).toBe(25);
    });

    it("rejects an order missing a required option", async () => {
      menuItemRepo.find.mockResolvedValue([
        menuItem({
          optionGroups: [
            {
              id: "size",
              name: "Size",
              required: true,
              maxSelections: 1,
              choices: [{ id: "reg", name: "Regular", priceDelta: 0 }],
            },
          ],
        }),
      ]);
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("requires an age confirmation when the order includes alcohol", async () => {
      menuItemRepo.find.mockResolvedValue([
        menuItem({ name: "Club Beer", containsAlcohol: true }),
      ]);
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
          ageConfirmed: true,
        }),
      ).resolves.toEqual(expect.objectContaining({ totalAmount: 10 }));
    });

    it("snapshots the restaurant's menu currency on the order", async () => {
      menuItemsService.getSettings.mockResolvedValue({
        ...SETTINGS,
        currency: "LRD",
      });
      const order = await service.create(BUYER_ID, BUSINESS_ID, {
        items: [{ menuItemId: "item-1", quantity: 1 }],
      });
      expect(order.currency).toBe("LRD");
    });

    it("defaults to pickup paid in cash with no delivery fee", async () => {
      const order = await service.create(BUYER_ID, BUSINESS_ID, {
        items: [{ menuItemId: "item-1", quantity: 1 }],
      });
      expect(order).toEqual(
        expect.objectContaining({
          fulfillment: FoodFulfillment.PICKUP,
          paymentMethod: FoodPaymentMethod.CASH,
          paymentStatus: FoodPaymentStatus.PAY_ON_DELIVERY,
          subtotal: 10,
          deliveryFee: 0,
          totalAmount: 10,
          deliveryAddress: null,
          paymentReference: null,
        }),
      );
    });

    const delivery = {
      fulfillment: FoodFulfillment.DELIVERY,
      deliveryAddress: "12 Tubman Blvd, Sinkor",
      contactPhone: "0777 000 111",
    };

    it("adds the restaurant's delivery fee to a delivery order", async () => {
      const order = await service.create(BUYER_ID, BUSINESS_ID, {
        items: [{ menuItemId: "item-1", quantity: 1 }],
        ...delivery,
      });
      expect(order).toEqual(
        expect.objectContaining({
          subtotal: 10,
          deliveryFee: 2,
          totalAmount: 12,
          deliveryAddress: "12 Tubman Blvd, Sinkor",
        }),
      );
    });

    it("waives the delivery fee once the free-delivery minimum is reached", async () => {
      const order = await service.create(BUYER_ID, BUSINESS_ID, {
        items: [{ menuItemId: "item-1", quantity: 3 }],
        ...delivery,
      });
      expect(order.deliveryFee).toBe(0);
      expect(order.totalAmount).toBe(30);
    });

    it("rejects delivery when the restaurant doesn't deliver", async () => {
      menuItemsService.getSettings.mockResolvedValue({
        ...SETTINGS,
        deliveryEnabled: false,
      });
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
          ...delivery,
        }),
      ).rejects.toThrow(/doesn't deliver/);
    });

    it("rejects pickup when the restaurant only delivers", async () => {
      menuItemsService.getSettings.mockResolvedValue({
        ...SETTINGS,
        pickupEnabled: false,
      });
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toThrow(/only takes delivery/);
    });

    it("requires an address and phone for delivery", async () => {
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
          ...delivery,
          deliveryAddress: "  ",
        }),
      ).rejects.toThrow(/address/);
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
          ...delivery,
          contactPhone: undefined,
        }),
      ).rejects.toThrow(/phone/);
    });

    it("takes Orange Money with a transaction ID, awaiting the owner's check", async () => {
      const order = await service.create(BUYER_ID, BUSINESS_ID, {
        items: [{ menuItemId: "item-1", quantity: 1 }],
        paymentMethod: FoodPaymentMethod.ORANGE_MONEY,
        paymentReference: " OM-48213 ",
      });
      expect(order).toEqual(
        expect.objectContaining({
          paymentMethod: FoodPaymentMethod.ORANGE_MONEY,
          paymentStatus: FoodPaymentStatus.AWAITING_VERIFICATION,
          paymentReference: "OM-48213",
          paymentAccount: "0777 123 456",
        }),
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        OWNER_ID,
        expect.objectContaining({
          body: expect.stringContaining(
            "Verify Orange Money transaction OM-48213",
          ),
        }),
      );
    });

    it("requires a transaction ID for mobile money", async () => {
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
          paymentMethod: FoodPaymentMethod.ORANGE_MONEY,
        }),
      ).rejects.toThrow(/transaction ID/);
    });

    it("rejects a payment method the restaurant doesn't take", async () => {
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
          paymentMethod: FoodPaymentMethod.MTN_MOMO,
          paymentReference: "123",
        }),
      ).rejects.toThrow(/doesn't accept MTN MoMo/);
      menuItemsService.getSettings.mockResolvedValue({
        ...SETTINGS,
        cashEnabled: false,
      });
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
        }),
      ).rejects.toThrow(/doesn't accept cash/);
    });

    it("rejects a transaction ID already used on another live order", async () => {
      orderRepo.save.mockRejectedValueOnce(
        Object.assign(new Error("duplicate key"), { code: "23505" }),
      );
      await expect(
        service.create(BUYER_ID, BUSINESS_ID, {
          items: [{ menuItemId: "item-1", quantity: 1 }],
          paymentMethod: FoodPaymentMethod.ORANGE_MONEY,
          paymentReference: "OM-1",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("notifies the business owner of a new order", async () => {
      await service.create(BUYER_ID, BUSINESS_ID, {
        items: [{ menuItemId: "item-1", quantity: 1 }],
      });
      expect(notificationsService.create).toHaveBeenCalledWith(
        OWNER_ID,
        expect.objectContaining({ type: "food_order.requested" }),
      );
    });
  });

  describe("respond", () => {
    function pendingOrder(overrides: Partial<FoodOrder> = {}): FoodOrder {
      return {
        id: "order-1",
        buyerUserId: BUYER_ID,
        business: approvedRestaurant(),
        status: FoodOrderStatus.PENDING,
        ...overrides,
      } as FoodOrder;
    }

    it("rejects a non-owner", async () => {
      orderRepo.findOne.mockResolvedValue(pendingOrder());
      await expect(
        service.respond(BUYER_ID, "order-1", { action: "confirm" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects responding to an order that already got a response", async () => {
      orderRepo.findOne.mockResolvedValue(
        pendingOrder({ status: FoodOrderStatus.CONFIRMED }),
      );
      await expect(
        service.respond(OWNER_ID, "order-1", { action: "confirm" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("confirms a pending order and notifies the buyer", async () => {
      orderRepo.findOne.mockResolvedValue(pendingOrder());
      await service.respond(OWNER_ID, "order-1", { action: "confirm" });
      expect(notificationsService.create).toHaveBeenCalledWith(
        BUYER_ID,
        expect.objectContaining({ type: "food_order.confirmed" }),
      );
    });

    it("declines a pending order and notifies the buyer", async () => {
      orderRepo.findOne.mockResolvedValue(pendingOrder());
      await service.respond(OWNER_ID, "order-1", { action: "decline" });
      expect(notificationsService.create).toHaveBeenCalledWith(
        BUYER_ID,
        expect.objectContaining({ type: "food_order.declined" }),
      );
    });
  });

  describe("respond with mobile money", () => {
    function momoOrder(): FoodOrder {
      return {
        id: "order-1",
        buyerUserId: BUYER_ID,
        business: approvedRestaurant(),
        status: FoodOrderStatus.PENDING,
        paymentMethod: FoodPaymentMethod.ORANGE_MONEY,
        paymentStatus: FoodPaymentStatus.AWAITING_VERIFICATION,
      } as FoodOrder;
    }

    it("marks the payment paid when the owner confirms", async () => {
      const order = momoOrder();
      orderRepo.findOne.mockResolvedValue(order);
      await service.respond(OWNER_ID, "order-1", { action: "confirm" });
      expect(order.paymentStatus).toBe(FoodPaymentStatus.PAID);
    });

    it("marks the payment failed when declined for a missing payment", async () => {
      const order = momoOrder();
      orderRepo.findOne.mockResolvedValue(order);
      await service.respond(OWNER_ID, "order-1", {
        action: "decline",
        paymentNotReceived: true,
      });
      expect(order.paymentStatus).toBe(FoodPaymentStatus.FAILED);
    });

    it("marks a refund due when a paid order is declined for another reason", async () => {
      const order = momoOrder();
      orderRepo.findOne.mockResolvedValue(order);
      await service.respond(OWNER_ID, "order-1", { action: "decline" });
      expect(order.paymentStatus).toBe(FoodPaymentStatus.REFUND_DUE);
      expect(notificationsService.create).toHaveBeenCalledWith(
        BUYER_ID,
        expect.objectContaining({
          body: expect.stringContaining("owes you a refund"),
        }),
      );
    });
  });

  describe("updateStatus", () => {
    function confirmed(overrides: Partial<FoodOrder> = {}): FoodOrder {
      return {
        id: "order-1",
        buyerUserId: BUYER_ID,
        business: approvedRestaurant(),
        status: FoodOrderStatus.CONFIRMED,
        fulfillment: FoodFulfillment.DELIVERY,
        paymentMethod: FoodPaymentMethod.CASH,
        paymentStatus: FoodPaymentStatus.PAY_ON_DELIVERY,
        ...overrides,
      } as FoodOrder;
    }

    it("only lets the owner update an order", async () => {
      orderRepo.findOne.mockResolvedValue(confirmed());
      await expect(
        service.updateStatus(BUYER_ID, "order-1", {
          status: FoodOrderStatus.PREPARING,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("moves a delivery order along and tells the customer", async () => {
      const order = confirmed();
      orderRepo.findOne.mockResolvedValue(order);
      await service.updateStatus(OWNER_ID, "order-1", {
        status: FoodOrderStatus.OUT_FOR_DELIVERY,
      });
      expect(order.status).toBe(FoodOrderStatus.OUT_FOR_DELIVERY);
      expect(notificationsService.create).toHaveBeenCalledWith(
        BUYER_ID,
        expect.objectContaining({
          type: "food_order.updated",
          title: "Your order is on the way",
        }),
      );
    });

    it("needs the order confirmed first", async () => {
      orderRepo.findOne.mockResolvedValue(
        confirmed({ status: FoodOrderStatus.PENDING }),
      );
      await expect(
        service.updateStatus(OWNER_ID, "order-1", {
          status: FoodOrderStatus.PREPARING,
        }),
      ).rejects.toThrow(/Confirm or decline/);
    });

    it("never moves an order backwards", async () => {
      orderRepo.findOne.mockResolvedValue(
        confirmed({ status: FoodOrderStatus.OUT_FOR_DELIVERY }),
      );
      await expect(
        service.updateStatus(OWNER_ID, "order-1", {
          status: FoodOrderStatus.PREPARING,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("keeps ready-for-pickup and out-for-delivery to their own order types", async () => {
      orderRepo.findOne.mockResolvedValue(confirmed());
      await expect(
        service.updateStatus(OWNER_ID, "order-1", {
          status: FoodOrderStatus.READY,
        }),
      ).rejects.toThrow(/delivery order/);
      orderRepo.findOne.mockResolvedValue(
        confirmed({ fulfillment: FoodFulfillment.PICKUP }),
      );
      await expect(
        service.updateStatus(OWNER_ID, "order-1", {
          status: FoodOrderStatus.OUT_FOR_DELIVERY,
        }),
      ).rejects.toThrow(/pickup order/);
    });

    it("records cash as paid when the order is completed", async () => {
      const order = confirmed({ status: FoodOrderStatus.OUT_FOR_DELIVERY });
      orderRepo.findOne.mockResolvedValue(order);
      await service.updateStatus(OWNER_ID, "order-1", {
        status: FoodOrderStatus.COMPLETED,
      });
      expect(order.paymentStatus).toBe(FoodPaymentStatus.PAID);
    });
  });

  describe("markRefunded", () => {
    it("records a refund that was due", async () => {
      const order = {
        id: "order-1",
        buyerUserId: BUYER_ID,
        business: approvedRestaurant(),
        status: FoodOrderStatus.DECLINED,
        paymentMethod: FoodPaymentMethod.ORANGE_MONEY,
        paymentStatus: FoodPaymentStatus.REFUND_DUE,
      };
      orderRepo.findOne.mockResolvedValue(order);
      await service.markRefunded(OWNER_ID, "order-1");
      expect(order.paymentStatus).toBe(FoodPaymentStatus.REFUNDED);
      expect(notificationsService.create).toHaveBeenCalledWith(
        BUYER_ID,
        expect.objectContaining({ type: "food_order.refunded" }),
      );
    });

    it("rejects an order with no refund due", async () => {
      orderRepo.findOne.mockResolvedValue({
        id: "order-1",
        business: approvedRestaurant(),
        paymentStatus: FoodPaymentStatus.PAID,
      });
      await expect(
        service.markRefunded(OWNER_ID, "order-1"),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("cancel", () => {
    it("rejects cancelling someone else's order", async () => {
      orderRepo.findOne.mockResolvedValue({
        id: "order-1",
        buyerUserId: BUYER_ID,
        status: FoodOrderStatus.PENDING,
      });
      await expect(
        service.cancel("someone-else", "order-1"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("rejects cancelling an order that's already been declined", async () => {
      orderRepo.findOne.mockResolvedValue({
        id: "order-1",
        buyerUserId: BUYER_ID,
        business: approvedRestaurant(),
        status: FoodOrderStatus.DECLINED,
      });
      await expect(service.cancel(BUYER_ID, "order-1")).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("lets the buyer cancel their own pending order", async () => {
      const order = {
        id: "order-1",
        buyerUserId: BUYER_ID,
        buyer: { name: "Alice" },
        business: approvedRestaurant(),
        status: FoodOrderStatus.PENDING,
        paymentMethod: FoodPaymentMethod.CASH,
        paymentStatus: FoodPaymentStatus.PAY_ON_DELIVERY,
      };
      orderRepo.findOne.mockResolvedValue(order);
      await service.cancel(BUYER_ID, "order-1");
      expect(order.status).toBe(FoodOrderStatus.CANCELLED);
      expect(notificationsService.create).toHaveBeenCalledWith(
        OWNER_ID,
        expect.objectContaining({ type: "food_order.cancelled" }),
      );
    });

    it("rejects cancelling once the restaurant has confirmed", async () => {
      orderRepo.findOne.mockResolvedValue({
        id: "order-1",
        buyerUserId: BUYER_ID,
        business: approvedRestaurant(),
        status: FoodOrderStatus.CONFIRMED,
      });
      await expect(service.cancel(BUYER_ID, "order-1")).rejects.toThrow(
        /already confirmed/,
      );
    });

    it("marks a cancelled mobile money order as refund due", async () => {
      const order = {
        id: "order-1",
        buyerUserId: BUYER_ID,
        buyer: { name: "Alice" },
        business: approvedRestaurant(),
        status: FoodOrderStatus.PENDING,
        paymentMethod: FoodPaymentMethod.ORANGE_MONEY,
        paymentStatus: FoodPaymentStatus.AWAITING_VERIFICATION,
      };
      orderRepo.findOne.mockResolvedValue(order);
      await service.cancel(BUYER_ID, "order-1");
      expect(order.paymentStatus).toBe(FoodPaymentStatus.REFUND_DUE);
    });
  });

  describe("findForBusiness", () => {
    it("rejects a non-owner", async () => {
      businessRepo.findOne.mockResolvedValue(approvedRestaurant());
      await expect(
        service.findForBusiness("someone-else", BUSINESS_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("returns the owner's incoming orders newest-first", async () => {
      businessRepo.findOne.mockResolvedValue(approvedRestaurant());
      await service.findForBusiness(OWNER_ID, BUSINESS_ID);
      expect(orderRepo.find).toHaveBeenCalledWith({
        where: { businessId: BUSINESS_ID },
        order: { createdAt: "DESC" },
      });
    });
  });
});
