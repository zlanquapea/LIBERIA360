import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { MenuItem } from "./entities/menu-item.entity";
import { Business } from "../businesses/entities/business.entity";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto";

@Injectable()
export class MenuItemsService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepo: Repository<MenuItem>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
  ) {}

  private async assertOwnsBusiness(
    userId: string,
    businessId: string,
  ): Promise<void> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this business");
    }
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
      description: dto.description ?? null,
      price: dto.price,
      image: dto.image ?? null,
      category: dto.category ?? null,
      isAvailable: dto.isAvailable ?? true,
      sortOrder: dto.sortOrder ?? count,
    });
    return this.menuItemRepo.save(item);
  }

  async update(
    userId: string,
    itemId: string,
    dto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    const item = await this.findOwnedOrFail(userId, itemId);
    this.menuItemRepo.merge(item, dto);
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
}
