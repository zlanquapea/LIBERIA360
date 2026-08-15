import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "./entities/place.entity";
import { QueryPlacesDto } from "./dto/query-places.dto";

export interface PaginatedPlaces {
  data: Place[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  /**
   * GET /places — filterable, paginated list (Tech Spec §10). Also used
   * internally to scope results to a single county (GET /counties/:id/places).
   */
  async findAll(
    query: QueryPlacesDto,
    countySlug?: string,
  ): Promise<PaginatedPlaces> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.placeRepo
      .createQueryBuilder("place")
      .leftJoinAndSelect("place.category", "category")
      .leftJoinAndSelect("place.county", "county");

    const effectiveCounty = countySlug ?? query.county;
    if (effectiveCounty) {
      qb.andWhere("county.slug = :countySlug", { countySlug: effectiveCounty });
    }
    if (query.category) {
      qb.andWhere("category.slug = :categorySlug", {
        categorySlug: query.category,
      });
    }
    if (query.tag) {
      qb.andWhere(":tag = ANY(place.tags)", { tag: query.tag });
    }
    if (query.type) {
      qb.andWhere("place.type = :type", { type: query.type });
    }
    if (query.q) {
      qb.andWhere("(place.name ILIKE :q OR place.description ILIKE :q)", {
        q: `%${query.q}%`,
      });
    }

    switch (query.sort) {
      case "rating":
        qb.orderBy("place.rating", "DESC");
        break;
      case "distance":
        qb.orderBy("place.distanceFromMonroviaKm", "ASC", "NULLS LAST");
        break;
      case "name":
        qb.orderBy("place.name", "ASC");
        break;
      case "featured":
      default:
        qb.orderBy("place.featured", "DESC").addOrderBy("place.rating", "DESC");
        break;
    }

    qb.skip((page - 1) * limit).take(limit);

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

  /** GET /places/:slug — full destination profile, required fields per Tech Spec §4.2. */
  async findBySlug(slug: string): Promise<Place> {
    const place = await this.placeRepo.findOne({
      where: { slug },
      relations: ["category", "county", "activities"],
    });
    if (!place) {
      throw new NotFoundException(`Place "${slug}" not found`);
    }
    return place;
  }
}
