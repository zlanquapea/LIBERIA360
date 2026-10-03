import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { Repository } from "typeorm";
import { MenuItem } from "./entities/menu-item.entity";
import { MenuSettings } from "./entities/menu-settings.entity";
import { MenuItemKind, MenuOptionGroup } from "./entities/menu-item.enums";
import { Business } from "../businesses/entities/business.entity";
import { businessHasMenu } from "../businesses/entities/business.enums";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto";
import { MenuOptionGroupDto } from "./dto/menu-option-group.dto";
import { UpdateMenuSettingsDto } from "./dto/update-menu-settings.dto";

/** Assigns ids to new groups/choices (kept stable for existing ones, so a
 * customer's in-progress cart still resolves after a menu edit), trims
 * names, and caps maxSelections at the number of choices that exist. */
export function normalizeOptionGroups(
  groups: MenuOptionGroupDto[],
): MenuOptionGroup[] {
  return groups.map((group) => {
    const choices = group.choices.map((choice) => ({
      id: choice.id || randomUUID(),
      name: choice.name.trim(),
      priceDelta: Math.round(choice.priceDelta * 100) / 100,
    }));
    return {
      id: group.id || randomUUID(),
      name: group.name.trim(),
      required: group.required,
      maxSelections: Math.min(group.maxSelections, choices.length),
      choices,
    };
  });
}

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepo: Repository<MenuItem>,
    @InjectRepository(MenuSettings)
    private readonly settingsRepo: Repository<MenuSettings>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
  ) {}

  private async assertOwnsBusiness(
    userId: string,
    businessId: string,
  ): Promise<Business> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this business");
    }
    if (!businessHasMenu(business.type)) {
      throw new BadRequestException(
        "Only restaurants and bars can have a menu",
      );
    }
    return business;
  }

  private async findOwnedOrFail(
    userId: string,
    itemId: string,
  ): Promise<MenuItem> {
    const item = await this.menuItemRepo.findOne({
      where: { id: itemId },
      relations: ["business"],
    });
    if (!item) {
      throw new NotFoundException(`Menu item "${itemId}" not found`);
    }
    if (item.business.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this business");
    }
    return item;
  }

  async create(userId: string, dto: CreateMenuItemDto): Promise<MenuItem> {
    await this.assertOwnsBusiness(userId, dto.businessId);
    const count = await this.menuItemRepo.count({
      where: { businessId: dto.businessId },
    });
    const item = this.menuItemRepo.create({
      businessId: dto.businessId,
      name: dto.name,
      description: dto.description?.trim() || null,
      price: dto.price,
      image: dto.image?.trim() || null,
      category: dto.category?.trim() || null,
      isAvailable: dto.isAvailable ?? true,
      sortOrder: dto.sortOrder ?? count,
      kind: dto.kind ?? MenuItemKind.FOOD,
      tags: [...new Set(dto.tags ?? [])],
      servingSize: dto.servingSize?.trim() || null,
      containsAlcohol: dto.containsAlcohol ?? false,
      optionGroups: normalizeOptionGroups(dto.optionGroups ?? []),
    });
    return this.menuItemRepo.save(item);
  }

  async update(
    userId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    const item = await this.findOwnedOrFail(userId, itemId);
    const {
      optionGroups,
      tags,
      servingSize,
      description,
      category,
      image,
      ...rest
    } = dto;
    this.menuItemRepo.merge(item, rest);
    // An empty string from the editor means "clear it", so it reads back as
    // null and never as an empty "" section heading on the public menu.
    if (description !== undefined) {
      item.description = description.trim() || null;
    }
    if (category !== undefined) item.category = category.trim() || null;
    if (image !== undefined) item.image = image.trim() || null;
    if (optionGroups !== undefined) {
      item.optionGroups = normalizeOptionGroups(optionGroups);
    }
    if (tags !== undefined) {
      item.tags = [...new Set(tags)];
    }
    if (servingSize !== undefined) {
      item.servingSize = servingSize.trim() || null;
    }
    return this.menuItemRepo.save(item);
  }

  async remove(userId: string, itemId: string): Promise<void> {
    const item = await this.findOwnedOrFail(userId, itemId);
    await this.menuItemRepo.remove(item);
  }

  /** The full menu for one business — public (no review gate, see
   * MenuItem's doc comment) and identical for the owner's own manage view,
   * so there's only the one getter. An unavailable item still comes back
   * (`isAvailable: false`) rather than being filtered out here — the
   * frontend renders it with a "Sold out" tag instead of hiding it, so a
   * diner planning ahead still sees the full menu and its prices. */
  findForBusiness(businessId: string): Promise<MenuItem[]> {
    return this.menuItemRepo.find({
      where: { businessId },
      order: { category: "ASC", sortOrder: "ASC", createdAt: "ASC" },
    });
  }

  /** Public. A business that never saved settings gets the defaults back
   * without a row being written. The mobile money numbers are public on
   * purpose: customers need them to pay. */
  async getSettings(businessId: string): Promise<MenuSettingsView> {
    const settings = await this.settingsRepo.findOne({
      where: { businessId },
    });
    return settings ? toSettingsView(settings) : defaultSettings(businessId);
  }

  async updateSettings(
    userId: string,
    businessId: string,
    dto: UpdateMenuSettingsDto,
  ): Promise<MenuSettingsView> {
    await this.assertOwnsBusiness(userId, businessId);
    const existing = await this.settingsRepo.findOne({
      where: { businessId },
    });
    const settings =
      existing ?? this.settingsRepo.create({ ...defaultSettings(businessId) });

    const text = (value: string) => value.trim() || null;
    if (dto.currency !== undefined) settings.currency = dto.currency;
    if (dto.pickupEnabled !== undefined) {
      settings.pickupEnabled = dto.pickupEnabled;
    }
    if (dto.deliveryEnabled !== undefined) {
      settings.deliveryEnabled = dto.deliveryEnabled;
    }
    if (dto.deliveryFee !== undefined) {
      settings.deliveryFee = roundMoney(dto.deliveryFee);
    }
    if (dto.freeDeliveryMinimum !== undefined) {
      settings.freeDeliveryMinimum =
        dto.freeDeliveryMinimum === null
          ? null
          : roundMoney(dto.freeDeliveryMinimum);
    }
    if (dto.deliveryAreas !== undefined) {
      settings.deliveryAreas = text(dto.deliveryAreas);
    }
    if (dto.deliveryEstimate !== undefined) {
      settings.deliveryEstimate = text(dto.deliveryEstimate);
    }
    if (dto.cashEnabled !== undefined) settings.cashEnabled = dto.cashEnabled;
    if (dto.mtnMomoNumber !== undefined) {
      settings.mtnMomoNumber = text(dto.mtnMomoNumber);
    }
    if (dto.orangeMoneyNumber !== undefined) {
      settings.orangeMoneyNumber = text(dto.orangeMoneyNumber);
    }
    if (dto.mobileMoneyName !== undefined) {
      settings.mobileMoneyName = text(dto.mobileMoneyName);
    }

    // Checked on the merged result, so a single PATCH can't leave the
    // restaurant with no way to hand over food or get paid.
    if (!settings.pickupEnabled && !settings.deliveryEnabled) {
      throw new BadRequestException("Offer at least one of pickup or delivery");
    }
    if (
      !settings.cashEnabled &&
      !settings.mtnMomoNumber &&
      !settings.orangeMoneyNumber
    ) {
      throw new BadRequestException(
        "Accept at least one payment method: cash, MTN MoMo or Orange Money",
      );
    }

    await this.settingsRepo.save(settings);
    return this.getSettings(businessId);
  }
}

export type MenuSettingsView = Omit<MenuSettings, "business" | "updatedAt">;

function defaultSettings(businessId: string): MenuSettingsView {
  return {
    businessId,
    currency: "USD",
    pickupEnabled: true,
    deliveryEnabled: false,
    deliveryFee: 0,
    freeDeliveryMinimum: null,
    deliveryAreas: null,
    deliveryEstimate: null,
    cashEnabled: true,
    mtnMomoNumber: null,
    orangeMoneyNumber: null,
    mobileMoneyName: null,
  };
}

function toSettingsView(settings: MenuSettings): MenuSettingsView {
  return {
    businessId: settings.businessId,
    currency: settings.currency,
    pickupEnabled: settings.pickupEnabled,
    deliveryEnabled: settings.deliveryEnabled,
    deliveryFee: settings.deliveryFee,
    freeDeliveryMinimum: settings.freeDeliveryMinimum,
    deliveryAreas: settings.deliveryAreas,
    deliveryEstimate: settings.deliveryEstimate,
    cashEnabled: settings.cashEnabled,
    mtnMomoNumber: settings.mtnMomoNumber,
    orangeMoneyNumber: settings.orangeMoneyNumber,
    mobileMoneyName: settings.mobileMoneyName,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
