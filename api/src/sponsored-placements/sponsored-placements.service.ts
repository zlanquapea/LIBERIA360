import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SponsoredPlacement } from "./entities/sponsored-placement.entity";
import { Place } from "../places/entities/place.entity";
import { CreateSponsoredPlacementDto } from "./dto/create-sponsored-placement.dto";
import { AdminAuditService } from "../admin/admin-audit.service";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class SponsoredPlacementsService {
  constructor(
    @InjectRepository(SponsoredPlacement)
    private readonly placementRepo: Repository<SponsoredPlacement>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  async create(
    adminUserId: string,
    dto: CreateSponsoredPlacementDto,
  ): Promise<SponsoredPlacement> {
    const place = await this.placeRepo.findOne({ where: { id: dto.placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException("endDate cannot be before startDate");
    }

    const placement = await this.placementRepo.save(
      this.placementRepo.create({
        placeId: dto.placeId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        createdByUserId: adminUserId,
      }),
    );
    await this.adminAuditService.log(
      adminUserId,
      "sponsored_placement.created",
      "sponsored_placement",
      placement.id,
      { placeId: dto.placeId, startDate: dto.startDate, endDate: dto.endDate },
    );
    return this.placementRepo.findOneOrFail({ where: { id: placement.id } });
  }

  /** Currently active placements — "Featured this week" (public). */
  findActive(): Promise<SponsoredPlacement[]> {
    const now = today();
    return this.placementRepo
      .createQueryBuilder("placement")
      .leftJoinAndSelect("placement.place", "place")
      .leftJoinAndSelect("place.category", "category")
      .leftJoinAndSelect("place.county", "county")
      .where("placement.startDate <= :now", { now })
      .andWhere("placement.endDate >= :now", { now })
      .orderBy("placement.startDate", "ASC")
      .getMany();
  }

  /** Full list — past, active, and upcoming — for admin management. */
  findAll(): Promise<SponsoredPlacement[]> {
    return this.placementRepo.find({ order: { startDate: "DESC" } });
  }

  async revoke(adminUserId: string, id: string): Promise<void> {
    const placement = await this.placementRepo.findOne({ where: { id } });
    if (!placement) {
      throw new NotFoundException(`Sponsored placement "${id}" not found`);
    }
    await this.placementRepo.delete({ id });
    await this.adminAuditService.log(
      adminUserId,
      "sponsored_placement.revoked",
      "sponsored_placement",
      id,
      { placeId: placement.placeId },
    );
  }
}
