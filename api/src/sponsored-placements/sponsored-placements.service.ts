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

  async revoke(id: string): Promise<void> {
    const result = await this.placementRepo.delete({ id });
    if (result.affected === 0) {
      throw new NotFoundException(`Sponsored placement "${id}" not found`);
    }
  }
}
