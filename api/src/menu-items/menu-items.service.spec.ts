import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { MenuItemsService } from "./menu-items.service";
import { MenuItem } from "./entities/menu-item.entity";
import { Business } from "../businesses/entities/business.entity";

const OWNER_ID = "owner-1";
const STRANGER_ID = "stranger-1";
const BUSINESS_ID = "business-1";
const ITEM_ID = "item-1";

describe("MenuItemsService", () => {
  let service: MenuItemsService;
  let menuItemRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    merge: jest.Mock;
    remove: jest.Mock;
  };
  let businessRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    menuItemRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((data) => data),
      save: jest.fn((data) => ({ id: ITEM_ID, ...data })),
      merge: jest.fn((entity, dto) => Object.assign(entity, dto)),
      remove: jest.fn(),
    };
    businessRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: BUSINESS_ID, ownerUserId: OWNER_ID }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuItemsService,
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
      ],
    }).compile();

    service = module.get(MenuItemsService);
  });

  describe("create", () => {
    it("404s an unknown business", async () => {
      businessRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(OWNER_ID, {
          businessId: BUSINESS_ID,
          name: "Jollof Rice",
          price: 8,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s a user who doesn't own the business", async () => {
      await expect(
        service.create(STRANGER_ID, {
          businessId: BUSINESS_ID,
          name: "Jollof Rice",
          price: 8,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(menuItemRepo.save).not.toHaveBeenCalled();
    });

    it("defaults optional fields and assigns sortOrder from the current count", async () => {
      menuItemRepo.count.mockResolvedValue(3);
      const item = await service.create(OWNER_ID, {
        businessId: BUSINESS_ID,
        name: "Jollof Rice",
        price: 8,
      });
      expect(menuItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: BUSINESS_ID,
          name: "Jollof Rice",
          description: null,
          price: 8,
          image: null,
          category: null,
          isAvailable: true,
          sortOrder: 3,
        }),
      );
      expect(item).toEqual(expect.objectContaining({ name: "Jollof Rice" }));
    });

    it("honors an explicit isAvailable/sortOrder/category/image", async () => {
      await service.create(OWNER_ID, {
        businessId: BUSINESS_ID,
        name: "Fried Fish",
        price: 12,
        image: "uploads/fish.jpg",
        category: "Mains",
        isAvailable: false,
        sortOrder: 5,
      });
      expect(menuItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          image: "uploads/fish.jpg",
          category: "Mains",
          isAvailable: false,
          sortOrder: 5,
        }),
      );
    });
  });

  describe("update", () => {
    it("404s an unknown item", async () => {
      menuItemRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(OWNER_ID, ITEM_ID, { price: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("403s a user who doesn't own the item's business", async () => {
      menuItemRepo.findOne.mockResolvedValue({
        id: ITEM_ID,
        business: { ownerUserId: OWNER_ID },
      });
      await expect(
        service.update(STRANGER_ID, ITEM_ID, { price: 10 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(menuItemRepo.save).not.toHaveBeenCalled();
    });

    it("merges the update onto the owned item", async () => {
      const existing = {
        id: ITEM_ID,
        name: "Jollof Rice",
        price: 8,
        business: { ownerUserId: OWNER_ID },
      };
      menuItemRepo.findOne.mockResolvedValue(existing);
      await service.update(OWNER_ID, ITEM_ID, {
        price: 9.5,
        isAvailable: false,
      });
      expect(menuItemRepo.merge).toHaveBeenCalledWith(existing, {
        price: 9.5,
        isAvailable: false,
      });
      expect(menuItemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ price: 9.5, isAvailable: false }),
      );
    });
  });

  describe("remove", () => {
    it("403s a user who doesn't own the item's business", async () => {
      menuItemRepo.findOne.mockResolvedValue({
        id: ITEM_ID,
        business: { ownerUserId: OWNER_ID },
      });
      await expect(service.remove(STRANGER_ID, ITEM_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(menuItemRepo.remove).not.toHaveBeenCalled();
    });

    it("removes an owned item", async () => {
      const existing = { id: ITEM_ID, business: { ownerUserId: OWNER_ID } };
      menuItemRepo.findOne.mockResolvedValue(existing);
      await service.remove(OWNER_ID, ITEM_ID);
      expect(menuItemRepo.remove).toHaveBeenCalledWith(existing);
    });
  });

  describe("findForBusiness", () => {
    it("returns every item for the business, including unavailable ones", async () => {
      menuItemRepo.find.mockResolvedValue([
        { id: "1", isAvailable: true },
        { id: "2", isAvailable: false },
      ]);
      const items = await service.findForBusiness(BUSINESS_ID);
      expect(menuItemRepo.find).toHaveBeenCalledWith({
        where: { businessId: BUSINESS_ID },
        order: { category: "ASC", sortOrder: "ASC", createdAt: "ASC" },
      });
      expect(items).toHaveLength(2);
    });
  });
});
