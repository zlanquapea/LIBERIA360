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
import { FoodOrderStatus } from "./entities/food-order.enums";
import { Business } from "../businesses/entities/business.entity";
import {
  BusinessReviewStatus,
  BusinessType,
} from "../businesses/entities/business.enums";
import { MenuItem } from "../menu-items/entities/menu-item.entity";
import { NotificationsService } from "../notifications/notifications.service";

const BUYER_ID = "buyer-1";
const OWNER_ID = "owner-1";
const BUSINESS_ID = "business-1";

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoodOrdersService,
        { provide: getRepositoryToken(FoodOrder), useValue: orderRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: NotificationsService, useValue: notificationsService },
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
        },
      ]);
      expect(order.totalAmount).toBe(30);
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
        status: FoodOrderStatus.PENDING,
      };
      orderRepo.findOne.mockResolvedValue(order);
      await service.cancel(BUYER_ID, "order-1");
      expect(order.status).toBe(FoodOrderStatus.CANCELLED);
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
