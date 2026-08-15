import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { County } from "./entities/county.entity";
import { PlacesService, PaginatedPlaces } from "../places/places.service";
import { QueryPlacesDto } from "../places/dto/query-places.dto";

export interface CountyWithCount extends County {
  placeCount: number;
}

@Injectable()
export class CountiesService {
  constructor(
    @InjectRepository(County)
    private readonly countyRepo: Repository<County>,
    private readonly placesService: PlacesService,
  ) {}

  /** GET /counties — all 15 counties with summary data (place count, rollout stage). */
  async findAll(): Promise<CountyWithCount[]> {
    const rows = await this.countyRepo
      .createQueryBuilder("county")
      .loadRelationCountAndMap("county.placeCount", "county.places")
      .orderBy("county.rolloutStage", "ASC")
      .addOrderBy("county.name", "ASC")
      .getMany();

    return rows as CountyWithCount[];
  }

  private async assertCountyExists(slug: string): Promise<void> {
    const county = await this.countyRepo.findOne({ where: { slug } });
    if (!county) {
      throw new NotFoundException(`County "${slug}" not found`);
    }
  }

  /** GET /counties/:id/places — places within a county (`:id` is the county slug). */
  async findPlaces(
    countySlug: string,
    query: QueryPlacesDto,
  ): Promise<PaginatedPlaces> {
    await this.assertCountyExists(countySlug);
    return this.placesService.findAll(query, countySlug);
  }
}
