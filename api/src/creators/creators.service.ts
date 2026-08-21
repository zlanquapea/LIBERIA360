import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Creator } from "./entities/creator.entity";
import { CreatorPortfolioItem } from "./entities/creator-portfolio-item.entity";
import { CreatorOffering } from "./entities/creator-offering.entity";
import { CreateCreatorDto } from "./dto/create-creator.dto";
import { UpdateCreatorDto } from "./dto/update-creator.dto";
import { SetFeaturedDto } from "./dto/set-featured.dto";
import { CreatePortfolioItemDto } from "./dto/create-portfolio-item.dto";
import { UpdatePortfolioItemDto } from "./dto/update-portfolio-item.dto";
import { CreateOfferingDto } from "./dto/create-offering.dto";
import { UpdateOfferingDto } from "./dto/update-offering.dto";
import { CreatorCategory } from "./entities/creator.enums";
import { clearStaleRelation } from "../common/typeorm-relations";

export interface PaginatedCreators {
  data: Creator[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface QueryCreatorsParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: CreatorCategory;
  countyId?: string;
  featuredOnly?: boolean;
}

// The public/self profile shape actually served to clients — Creator plus
// its two related lists, loaded as a separate query rather than a
// declared TypeORM relation on the entity (keeps Creator itself
// relation-light, same reasoning as the doc comment on the entity).
export interface CreatorWithRelated extends Creator {
  portfolioItems: CreatorPortfolioItem[];
  offerings: CreatorOffering[];
}

@Injectable()
export class CreatorsService {
  constructor(
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(CreatorPortfolioItem)
    private readonly portfolioRepo: Repository<CreatorPortfolioItem>,
    @InjectRepository(CreatorOffering)
    private readonly offeringRepo: Repository<CreatorOffering>,
  ) {}

  async create(userId: string, dto: CreateCreatorDto): Promise<Creator> {
    const existingForUser = await this.creatorRepo.findOne({
      where: { userId },
    });
    if (existingForUser) {
      throw new ConflictException("You already have a creator profile");
    }

    const existingUsername = await this.creatorRepo.findOne({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException(
        `Username "${dto.username}" is already taken`,
      );
    }

    const creator = await this.creatorRepo.save(
      this.creatorRepo.create({ ...dto, userId }),
    );
    return this.creatorRepo.findOneOrFail({ where: { id: creator.id } });
  }

  async update(userId: string, dto: UpdateCreatorDto): Promise<Creator> {
    const creator = await this.getOwned(userId);

    if (dto.username && dto.username !== creator.username) {
      const existingUsername = await this.creatorRepo.findOne({
        where: { username: dto.username },
      });
      if (existingUsername) {
        throw new ConflictException(
          `Username "${dto.username}" is already taken`,
        );
      }
    }

    if (dto.countyId) {
      // `county` is `eager: true` — see clearStaleRelation's doc comment;
      // without this, reassigning countyId (home county) silently no-ops.
      clearStaleRelation(creator, "county");
    }
    this.creatorRepo.merge(creator, dto);
    await this.creatorRepo.save(creator);
    return this.creatorRepo.findOneOrFail({ where: { userId } });
  }

  findMine(userId: string): Promise<Creator | null> {
    return this.creatorRepo.findOne({ where: { userId } });
  }

  async findMineWithRelated(
    userId: string,
  ): Promise<CreatorWithRelated | null> {
    const creator = await this.findMine(userId);
    if (!creator) return null;
    return this.attachRelated(creator);
  }

  async findByUsername(username: string): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({ where: { username } });
    if (!creator) {
      throw new NotFoundException(`Creator "${username}" not found`);
    }
    return creator;
  }

  async findByUsernameWithRelated(
    username: string,
  ): Promise<CreatorWithRelated> {
    const creator = await this.findByUsername(username);
    return this.attachRelated(creator);
  }

  private async attachRelated(creator: Creator): Promise<CreatorWithRelated> {
    const [portfolioItems, offerings] = await Promise.all([
      this.portfolioRepo.find({
        where: { creatorId: creator.id },
        order: { sortOrder: "ASC", createdAt: "ASC" },
      }),
      this.offeringRepo.find({
        where: { creatorId: creator.id },
        order: { sortOrder: "ASC", createdAt: "ASC" },
      }),
    ]);
    return { ...creator, portfolioItems, offerings };
  }

  async setFeatured(creatorId: string, dto: SetFeaturedDto): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException(`Creator "${creatorId}" not found`);
    }
    creator.featured = dto.featured;
    await this.creatorRepo.save(creator);
    return creator;
  }

  async findAll(params: QueryCreatorsParams = {}): Promise<PaginatedCreators> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    // Query builder, not find()/findAndCount() — TypeORM only auto-joins
    // `eager: true` relations (Creator.user, Creator.county) through the
    // find* methods; a query builder needs them joined explicitly or
    // `creator.user`/`creator.county` come back undefined here.
    const qb = this.creatorRepo
      .createQueryBuilder("creator")
      .leftJoinAndSelect("creator.user", "user")
      .leftJoinAndSelect("creator.county", "county")
      .orderBy("creator.featured", "DESC")
      .addOrderBy("creator.followerCount", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (params.search) {
      qb.andWhere(
        "(creator.name ILIKE :search OR creator.username ILIKE :search)",
        { search: `%${params.search}%` },
      );
    }
    if (params.category) {
      qb.andWhere("creator.category = :category", {
        category: params.category,
      });
    }
    if (params.countyId) {
      qb.andWhere("creator.countyId = :countyId", {
        countyId: params.countyId,
      });
    }
    if (params.featuredOnly) {
      qb.andWhere("creator.featured = true");
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // Throws instead of returning null — every mutation below (portfolio and
  // offering CRUD) requires an existing profile, so this is the shared
  // "you must be a creator to do this" gate.
  private async getOwned(userId: string): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({ where: { userId } });
    if (!creator) {
      throw new NotFoundException("You do not have a creator profile yet");
    }
    return creator;
  }

  // --- Portfolio ---

  async addPortfolioItem(
    userId: string,
    dto: CreatePortfolioItemDto,
  ): Promise<CreatorPortfolioItem> {
    const creator = await this.getOwned(userId);
    const count = await this.portfolioRepo.count({
      where: { creatorId: creator.id },
    });
    return this.portfolioRepo.save(
      this.portfolioRepo.create({
        ...dto,
        creatorId: creator.id,
        sortOrder: count,
      }),
    );
  }

  async updatePortfolioItem(
    userId: string,
    itemId: string,
    dto: UpdatePortfolioItemDto,
  ): Promise<CreatorPortfolioItem> {
    const item = await this.getOwnedPortfolioItem(userId, itemId);
    this.portfolioRepo.merge(item, dto);
    return this.portfolioRepo.save(item);
  }

  async removePortfolioItem(userId: string, itemId: string): Promise<void> {
    const item = await this.getOwnedPortfolioItem(userId, itemId);
    await this.portfolioRepo.remove(item);
  }

  private async getOwnedPortfolioItem(
    userId: string,
    itemId: string,
  ): Promise<CreatorPortfolioItem> {
    const creator = await this.getOwned(userId);
    const item = await this.portfolioRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException(`Portfolio item "${itemId}" not found`);
    }
    if (item.creatorId !== creator.id) {
      throw new ForbiddenException("This portfolio item isn't yours");
    }
    return item;
  }

  // --- Offerings ---

  async addOffering(
    userId: string,
    dto: CreateOfferingDto,
  ): Promise<CreatorOffering> {
    const creator = await this.getOwned(userId);
    const count = await this.offeringRepo.count({
      where: { creatorId: creator.id },
    });
    return this.offeringRepo.save(
      this.offeringRepo.create({
        ...dto,
        creatorId: creator.id,
        sortOrder: count,
      }),
    );
  }

  async updateOffering(
    userId: string,
    offeringId: string,
    dto: UpdateOfferingDto,
  ): Promise<CreatorOffering> {
    const offering = await this.getOwnedOffering(userId, offeringId);
    this.offeringRepo.merge(offering, dto);
    return this.offeringRepo.save(offering);
  }

  async removeOffering(userId: string, offeringId: string): Promise<void> {
    const offering = await this.getOwnedOffering(userId, offeringId);
    await this.offeringRepo.remove(offering);
  }

  private async getOwnedOffering(
    userId: string,
    offeringId: string,
  ): Promise<CreatorOffering> {
    const creator = await this.getOwned(userId);
    const offering = await this.offeringRepo.findOne({
      where: { id: offeringId },
    });
    if (!offering) {
      throw new NotFoundException(`Offering "${offeringId}" not found`);
    }
    if (offering.creatorId !== creator.id) {
      throw new ForbiddenException("This offering isn't yours");
    }
    return offering;
  }
}
