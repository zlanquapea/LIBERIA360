import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { MenuItemsService, normalizeOptionGroups } from "./menu-items.service";
import { MenuItem } from "./entities/menu-item.entity";
import { MenuSettings } from "./entities/menu-settings.entity";
import { MenuItemKind } from "./entities/menu-item.enums";
import { Business } from "../businesses/entities/business.entity";
import { BusinessType } from "../businesses/entities/business.enums";

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
  let settingsRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

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
      findOne: jest.fn().mockResolvedValue({
        id: BUSINESS_ID,
        ownerUserId: OWNER_ID,
        type: BusinessType.RESTAURANT,
      }),
    };
    settingsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => data),
      save: jest.fn((data) => data),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MenuItemsService,
        { provide: getRepositoryToken(MenuItem), useValue: menuItemRepo },
        { provide: getRepositoryToken(Business), useValue: businessRepo },
        { provide: getRepositoryToken(MenuSettings), useValue: settingsRepo },
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

  describe("menu-type gate", () => {
    it("rejects adding a menu item to a business that can't have a menu", async () => {
      businessRepo.findOne.mockResolvedValue({
        id: BUSINESS_ID,
        ownerUserId: OWNER_ID,
        type: BusinessType.HOTEL,
      });
      await expect(
        service.create(OWNER_ID, {
          businessId: BUSINESS_ID,
          name: "Club Beer",
          price: 3,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("lets a bar add drinks", async () => {
      businessRepo.findOne.mockResolvedValue({
        id: BUSINESS_ID,
        ownerUserId: OWNER_ID,
        type: BusinessType.BAR,
      });
      await service.create(OWNER_ID, {
        businessId: BUSINESS_ID,
        name: "Club Beer",
        price: 3,
        kind: MenuItemKind.DRINK,
        servingSize: " 600ml ",
        containsAlcohol: true,
      });
      expect(menuItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: MenuItemKind.DRINK,
          servingSize: "600ml",
          containsAlcohol: true,
        }),
      );
    });
  });

  describe("drinks, tags and options", () => {
    it("defaults kind to food with no tags or options", async () => {
      await service.create(OWNER_ID, {
        businessId: BUSINESS_ID,
        name: "Jollof Rice",
        price: 8,
      });
      expect(menuItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: MenuItemKind.FOOD,
          tags: [],
          servingSize: null,
          containsAlcohol: false,
          optionGroups: [],
        }),
      );
    });

    it("dedupes tags", async () => {
      await service.create(OWNER_ID, {
        businessId: BUSINESS_ID,
        name: "Pepper Soup",
        price: 7,
        tags: ["spicy", "popular", "spicy"],
      });
      expect(menuItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["spicy", "popular"] }),
      );
    });

    it("replaces option groups on update, keeping existing ids", async () => {
      const existing = {
        id: ITEM_ID,
        business: { ownerUserId: OWNER_ID },
        optionGroups: [],
      };
      menuItemRepo.findOne.mockResolvedValue(existing);
      await service.update(OWNER_ID, ITEM_ID, {
        optionGroups: [
          {
            id: "size",
            name: "Size",
            required: true,
            maxSelections: 1,
            choices: [
              { id: "small", name: "Small", priceDelta: 0 },
              { name: "Large", priceDelta: 2 },
            ],
          },
        ],
      });
      const saved = menuItemRepo.save.mock.calls[0][0];
      expect(saved.optionGroups[0].id).toBe("size");
      expect(saved.optionGroups[0].choices[0].id).toBe("small");
      expect(saved.optionGroups[0].choices[1].id).toEqual(expect.any(String));
    });

    it("clears servingSize when sent an empty string", async () => {
      const existing = {
        id: ITEM_ID,
        business: { ownerUserId: OWNER_ID },
        servingSize: "330ml",
      };
      menuItemRepo.findOne.mockResolvedValue(existing);
      await service.update(OWNER_ID, ITEM_ID, { servingSize: "" });
      expect(menuItemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ servingSize: null }),
      );
    });

    it("clears description, category and image when sent empty strings", async () => {
      const existing = {
        id: ITEM_ID,
        business: { ownerUserId: OWNER_ID },
        description: "Old",
        category: "Mains",
        image: "/uploads/a.jpg",
      };
      menuItemRepo.findOne.mockResolvedValue(existing);
      await service.update(OWNER_ID, ITEM_ID, {
        description: " ",
        category: "",
        image: "",
      });
      expect(menuItemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          category: null,
          image: null,
        }),
      );
    });
  });

  describe("normalizeOptionGroups", () => {
    it("trims names, assigns missing ids, and caps maxSelections at the choice count", () => {
      const [group] = normalizeOptionGroups([
        {
          name: "  Extras ",
          required: false,
          maxSelections: 5,
          choices: [
            { name: " Fried plantain ", priceDelta: 1.256 },
            { name: "Egg", priceDelta: 0.5 },
          ],
        },
      ]);
      expect(group.id).toEqual(expect.any(String));
      expect(group.name).toBe("Extras");
      expect(group.maxSelections).toBe(2);
      expect(group.choices[0]).toEqual(
        expect.objectContaining({ name: "Fried plantain", priceDelta: 1.26 }),
      );
    });
  });

  describe("settings", () => {
    it("returns USD defaults for a business that never saved settings", async () => {
      await expect(service.getSettings(BUSINESS_ID)).resolves.toEqual({
        businessId: BUSINESS_ID,
        currency: "USD",
      });
    });

    it("403s a stranger changing another business's currency", async () => {
      await expect(
        service.updateSettings(STRANGER_ID, BUSINESS_ID, { currency: "LRD" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(settingsRepo.save).not.toHaveBeenCalled();
    });

    it("creates the settings row on the owner's first change", async () => {
      settingsRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ businessId: BUSINESS_ID, currency: "LRD" });
      const result = await service.updateSettings(OWNER_ID, BUSINESS_ID, {
        currency: "LRD",
      });
      expect(settingsRepo.save).toHaveBeenCalledWith({
        businessId: BUSINESS_ID,
        currency: "LRD",
      });
      expect(result.currency).toBe("LRD");
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
