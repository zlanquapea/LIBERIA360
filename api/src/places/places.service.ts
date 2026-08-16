import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "./entities/place.entity";
import { QueryPlacesDto } from "./dto/query-places.dto";

export type PlaceWithDistance = Place & { distanceKm: number | null };

export interface PaginatedPlaces {
  data: PlaceWithDistance[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Haversine distance in km between (:lat,:lng) and each place's lat/lng.
// No PostGIS at this catalog size (see api/README.md) — this is the
// standard SQL fallback for "how far is X from here" without it.
const HAVERSINE_KM_SQL = `
  6371 * acos(
    LEAST(1, GREATEST(-1,
      cos(radians(:lat)) * cos(radians(place.latitude)) * cos(radians(place.longitude) - radians(:lng))
      + sin(radians(:lat)) * sin(radians(place.latitude))
    ))
  )
`;

// Postgres full-text search, not ILIKE substring matching — handles word
// stemming ("beaches" matches "beach"), multi-word queries, and relevance
// ranking, none of which ILIKE '%...%' can do. name is weighted 'A'
// (highest), description 'B' — a match in the name should outrank a
// match buried in the description. This exact expression has to stay
// textually in sync with the migration's GIN index
// (AddPlacesFullTextSearchIndex) for Postgres to actually use it instead
// of scanning every row.
const SEARCH_VECTOR_SQL = `
  (
    setweight(to_tsvector('english', coalesce(place.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(place.description, '')), 'B')
  )
`;

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  /**
   * GET /places — filterable, paginated list (Tech Spec §10). Also used
   * internally to scope results to a single county (GET /counties/:id/places).
   * Supports "Near Me" radius search (§3.2) when lat/lng/radiusKm are given.
   */
  async findAll(
    query: QueryPlacesDto,
    countySlug?: string,
  ): Promise<PaginatedPlaces> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const nearParamsGiven = [query.lat, query.lng, query.radiusKm].filter(
      (v) => v !== undefined,
    ).length;
    if (nearParamsGiven > 0 && nearParamsGiven < 3) {
      throw new BadRequestException(
        "lat, lng, and radiusKm must all be provided together for Near Me search",
      );
    }
    const isNearSearch = nearParamsGiven === 3;

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
    // websearch_to_tsquery understands plain search-engine-style input
    // (quoted phrases, "or", a leading "-" to exclude a word) without the
    // caller needing to know tsquery's own operator syntax — the same
    // input shape a free-text search box already produces.
    if (query.q) {
      qb.andWhere(
        `${SEARCH_VECTOR_SQL} @@ websearch_to_tsquery('english', :q)`,
        {
          q: query.q,
        },
      );
    }

    if (isNearSearch) {
      const params = { lat: query.lat, lng: query.lng };
      qb.andWhere(`${HAVERSINE_KM_SQL} <= :radiusKm`, {
        ...params,
        radiusKm: query.radiusKm,
      });
    }

    // Count against the filtered-but-unpaginated query before adding
    // select/order-by, which getCount() ignores anyway.
    const total = await qb.getCount();

    if (isNearSearch) {
      qb.addSelect(HAVERSINE_KM_SQL, "distance_km").orderBy(
        "distance_km",
        "ASC",
      );
    } else {
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
          // A free-text search with no explicit sort should rank by how
          // well a result matches the query, not by curation/rating —
          // "featured, then rating" is the right default for *browsing*,
          // but once someone's typed a search, relevance is what they
          // actually asked for. An explicit ?sort=rating/distance/name
          // alongside ?q= still wins (this only applies to the default).
          if (query.q) {
            // TypeORM's orderBy() can't take an arbitrary raw expression
            // directly — it expects an alias it already knows about, the
            // same reason distance_km below is select()ed under a name
            // first rather than ordered by the raw Haversine expression.
            qb.addSelect(
              `ts_rank(${SEARCH_VECTOR_SQL}, websearch_to_tsquery('english', :q))`,
              "search_rank",
            ).orderBy("search_rank", "DESC");
          } else {
            qb.orderBy("place.featured", "DESC").addOrderBy(
              "place.rating",
              "DESC",
            );
          }
          break;
      }
    }

    qb.skip((page - 1) * limit).take(limit);

    let data: PlaceWithDistance[];
    if (isNearSearch) {
      const { entities, raw } = await qb.getRawAndEntities();
      data = entities.map((place, i) =>
        Object.assign(place, {
          distanceKm: Math.round(raw[i].distance_km * 10) / 10,
        }),
      );
    } else {
      const entities = await qb.getMany();
      data = entities.map((place) =>
        Object.assign(place, { distanceKm: null }),
      );
    }

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
