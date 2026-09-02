import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "./entities/place.entity";
import { PlaceReviewStatus } from "./entities/place.enums";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { QueryPlacesDto } from "./dto/query-places.dto";
import { CreatePlaceSubmissionDto } from "./dto/create-place-submission.dto";
import { UpdateMyPlaceDto } from "./dto/update-my-place.dto";
import { isOpenAt, parseOpeningHoursText } from "./opening-hours";
import { parseNaturalLanguageQuery } from "./nl-query";
import { BusinessesService } from "../businesses/businesses.service";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";
import { clearStaleRelation } from "../common/typeorm-relations";

const MODERATION_QUEUE_LINK = "/admin/content/moderation";

export type PlaceWithDistance = Place & { distanceKm: number | null };

/** Slugifies `name`, deduping against any existing row by appending -2,
 * -3, ... — unlike the admin's CreatePlaceDto (where an admin types the
 * slug by hand), a self-submitted place has no one to ask for one; see
 * buildBusinessSlug for the identical pattern. */
export async function buildPlaceSlug(
  placeRepo: Repository<Place>,
  name: string,
): Promise<string> {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "place";
  let slug = base;
  let suffix = 2;
  while (await placeRepo.exists({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

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

// Home's "Discover this week" shelf (replaced the old Weekend Explorer
// banner): real, current usage rather than admin curation. A trailing
// window, not calendar-week, so Monday morning isn't a cold reset. A
// correlated scalar subquery — same technique as HAVERSINE_KM_SQL above —
// rather than a JOIN+GROUP BY, since Postgres would otherwise require every
// selected column from the leftJoinAndSelect'd category/county relations in
// the GROUP BY too.
export const PLACE_TRENDING_WINDOW_DAYS = 7;
const VIEWS_THIS_WEEK_SQL = `(
  SELECT COUNT(*) FROM analytics_events ae
  WHERE ae.place_id = place.id
    AND ae.event_type = 'view'
    AND ae.created_at >= :trendingSince
)`;

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

// Product review readout (Aug 22, 2026), "search recovery": "beach"
// returning nothing despite Beaches being a supported category — a search
// term matching a category's own name (or a common alias for it) should
// surface that category's places even when the free-text match on
// name/description comes up empty. Keyed by category slug so it stays
// correct if a category is ever renamed.
export const CATEGORY_ALIASES: Record<string, string[]> = {
  beaches: [
    "beach",
    "coast",
    "coastal",
    "seaside",
    "swimming",
    "surf",
    "surfing",
  ],
  "waterfalls-nature": ["waterfall", "nature", "outdoors", "scenic"],
  "hiking-adventure": ["hiking", "hike", "adventure", "trek", "trekking"],
  "culture-heritage": ["culture", "heritage", "history", "historic", "museum"],
  "food-dining": ["food", "restaurant", "dining", "eat", "cuisine"],
  nightlife: ["nightlife", "bar", "club", "party"],
  "wildlife-eco-tourism": ["wildlife", "eco", "safari", "animal"],
  "hotels-lodges": ["hotel", "lodge", "stay", "accommodation", "lodging"],
  "city-shopping": ["shopping", "mall", "market", "city"],
  "islands-boat-trips": ["island", "boat", "sailing", "ferry"],
};

export function singularize(word: string): string {
  return word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word;
}

// Only matches a single-word query — a real multi-word search phrase
// ("beach near Monrovia") should go through full-text search as normal,
// not get hijacked into "show me everything in Beaches".
export function findMatchingCategory<T extends { name: string; slug: string }>(
  categories: T[],
  query: string,
): T | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const q = singularize(trimmed);

  for (const category of categories) {
    const words = `${category.name} ${category.slug}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map(singularize);
    if (words.includes(q)) return category;

    const aliases = CATEGORY_ALIASES[category.slug] ?? [];
    if (aliases.map(singularize).includes(q)) return category;
  }
  return null;
}

@Injectable()
export class PlacesService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(County)
    private readonly countyRepo: Repository<County>,
    private readonly businessesService: BusinessesService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  /** Tells every admin a place needs a review decision — the "someone
   * submitted/resubmitted something" half of moderation, mirroring
   * setPlaceReviewStatus's "here's the decision" half in AdminService. */
  private async notifyAdminsOfPendingPlace(place: Place): Promise<void> {
    const adminIds = await this.usersService.findAdminIds();
    await this.notificationsService.createMany(adminIds, {
      type: "admin.place_pending_review",
      title: "Place pending review",
      body: `"${place.name}" is waiting for a review decision.`,
      link: MODERATION_QUEUE_LINK,
    });
  }

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

    // Natural-language intent extraction (nl-query.ts): "Find me a
    // restaurant in Sinkor" implies category=food-dining; "things to do in
    // Monrovia tonight" implies openNow=true. Only fills in filters the
    // caller didn't already explicitly set, and only bothers loading
    // categories/counties when there's a free-text query to parse at all.
    let categories: Category[] | undefined;
    let nlCategoryId: string | undefined;
    let nlCountySlug: string | undefined;
    let nlOpenNow: boolean | undefined;
    let nlPriceMin: number | undefined;
    let nlPriceMax: number | undefined;
    if (query.q) {
      categories = await this.categoryRepo.find();
      const counties = await this.countyRepo.find();
      const nlParsed = parseNaturalLanguageQuery(query.q, categories, counties);
      if (nlParsed.category) {
        nlCategoryId = categories.find((c) => c.slug === nlParsed.category)?.id;
      }
      nlCountySlug = nlParsed.county;
      nlOpenNow = nlParsed.openNow;
      nlPriceMin = nlParsed.priceMin;
      nlPriceMax = nlParsed.priceMax;
    }

    const effectiveCounty = countySlug ?? query.county ?? nlCountySlug;
    const effectiveOpenNow = query.openNow ?? nlOpenNow;
    const effectivePriceMin = query.priceMin ?? nlPriceMin;
    const effectivePriceMax = query.priceMax ?? nlPriceMax;

    const qb = this.placeRepo
      .createQueryBuilder("place")
      .leftJoinAndSelect("place.category", "category")
      .leftJoinAndSelect("place.county", "county")
      // Public catalog browsing (this method's only two callers: the
      // public PlacesController and CountiesController's per-county
      // listing) never surfaces a place still pending review — see
      // PlaceReviewStatus's doc comment. The admin moderation queue uses
      // its own separate query (AdminContentService.findPlaces), which
      // deliberately does NOT apply this filter.
      .where("place.reviewStatus = :reviewStatus", {
        reviewStatus: PlaceReviewStatus.APPROVED,
      });

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
      const matchedCategory =
        findMatchingCategory(categories!, query.q) ??
        (!query.category && nlCategoryId
          ? (categories!.find((c) => c.id === nlCategoryId) ?? null)
          : null);
      if (matchedCategory) {
        // Union, not replace: a query like "beach" should still favor a
        // place whose name/description literally says "beach" (via
        // search_rank below) while also pulling in every other place in
        // the Beaches category that the free-text match alone would miss.
        // This is also how an NL-detected category (e.g. "restaurant in
        // Sinkor" → food-dining) is applied — as a union, not a strict AND
        // — so it surfaces every restaurant rather than requiring the
        // literal sentence to appear in a place's name/description.
        qb.andWhere(
          `(${SEARCH_VECTOR_SQL} @@ websearch_to_tsquery('english', :q) OR category.id = :matchedCategoryId)`,
          { q: query.q, matchedCategoryId: matchedCategory.id },
        );
      } else {
        qb.andWhere(
          `${SEARCH_VECTOR_SQL} @@ websearch_to_tsquery('english', :q)`,
          {
            q: query.q,
          },
        );
      }
    }

    if (isNearSearch) {
      const params = { lat: query.lat, lng: query.lng };
      qb.andWhere(`${HAVERSINE_KM_SQL} <= :radiusKm`, {
        ...params,
        radiusKm: query.radiusKm,
      });
    }

    if (effectivePriceMin !== undefined || effectivePriceMax !== undefined) {
      // A place with no cost on file is excluded rather than assumed to
      // match — same conservative "we don't know" stance as openNow above.
      qb.andWhere("place.estimatedCostEntry IS NOT NULL");
      if (effectivePriceMin !== undefined) {
        qb.andWhere("place.estimatedCostEntry >= :priceMin", {
          priceMin: effectivePriceMin,
        });
      }
      if (effectivePriceMax !== undefined) {
        qb.andWhere("place.estimatedCostEntry <= :priceMax", {
          priceMax: effectivePriceMax,
        });
      }
    }

    if (effectiveOpenNow) {
      // Whether a place is open right now depends on evaluating an array
      // of {dayOfWeek, opens, closes} periods against the current day/time
      // — awkward to express as a single SQL predicate (and this catalog
      // is small enough that it doesn't need to be, same tradeoff as the
      // Haversine distance calc above). Fetch the id + structuredHours for
      // every row the *other* filters already narrowed down to, decide
      // open-now in plain JS, then constrain the real query to just those
      // ids before it computes its (still correctly paginated) count/page.
      const candidates = await qb
        .clone()
        .select(["place.id", "place.structuredHours"])
        .getMany();
      const now = new Date();
      const openNowIds = candidates
        .filter((p) => isOpenAt(p.structuredHours, now))
        .map((p) => p.id);
      if (openNowIds.length === 0) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 1 } };
      }
      qb.andWhere("place.id IN (:...openNowIds)", { openNowIds });
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
        case "popular": {
          const trendingSince = new Date(
            Date.now() - PLACE_TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
          );
          qb.addSelect(VIEWS_THIS_WEEK_SQL, "views_this_week")
            .setParameter("trendingSince", trendingSince)
            .orderBy("views_this_week", "DESC")
            .addOrderBy("place.rating", "DESC");
          break;
        }
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

  /** GET /places/:slug — full destination profile, required fields per Tech Spec §4.2.
   * APPROVED-only, same reasoning as findAll — a place a submitter can
   * already reach by slug (e.g. a stale bookmark, or a guess) still isn't
   * public until an admin's approved it. The submitter's own pending/
   * rejected place is still reachable — via findMine, not this method. */
  async findBySlug(slug: string): Promise<Place> {
    const place = await this.placeRepo.findOne({
      where: { slug, reviewStatus: PlaceReviewStatus.APPROVED },
      relations: ["category", "county", "activities"],
    });
    if (!place) {
      throw new NotFoundException(`Place "${slug}" not found`);
    }
    return place;
  }

  /** Self-service submission (POST /places) — a business owner listing a
   * destination that isn't in the catalog yet. Starts in
   * SUBMITTED_FOR_REVIEW, not live until an admin approves it — see
   * PlaceReviewStatus's doc comment. Also auto-claims the new place as a
   * Business owned by this same user (see
   * BusinessesService.autoClaimSubmittedPlace) — a submitter listing their
   * own place shouldn't have to separately click "claim this listing" on
   * the exact thing they just created. Admin/super-admin-created places
   * (AdminContentService.createPlace) are unaffected and stay open for
   * whoever the real owner is to claim later, same as always — this only
   * fires for self-service submissions, where the owner is already known. */
  async submitPlace(
    userId: string,
    dto: CreatePlaceSubmissionDto,
  ): Promise<Place> {
    const place = this.placeRepo.create({
      name: dto.name,
      slug: await buildPlaceSlug(this.placeRepo, dto.name),
      description: dto.description,
      type: dto.type,
      categoryId: dto.categoryId,
      countyId: dto.countyId,
      city: dto.city,
      latitude: dto.latitude,
      longitude: dto.longitude,
      tags: dto.tags ?? [],
      recommendedVisitLength: dto.recommendedVisitLength ?? null,
      estimatedCostEntry: dto.estimatedCostEntry ?? null,
      estimatedCostGuide: dto.estimatedCostGuide ?? null,
      estimatedCostTransport: dto.estimatedCostTransport ?? null,
      images: dto.images ?? [],
      videos: dto.videos ?? [],
      openingHours: dto.openingHours ?? null,
      structuredHours: parseOpeningHoursText(dto.openingHours),
      contactPhone: dto.contactPhone ?? null,
      whatsapp: dto.whatsapp ?? null,
      website: dto.website ?? null,
      instagram: dto.instagram ?? null,
      facebook: dto.facebook ?? null,
      ownerUserId: userId,
      reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW,
      submittedAt: new Date(),
    });
    const saved = await this.placeRepo.save(place);

    // Never lets this secondary effect fail the primary action — the place
    // already exists by the time this runs, and a hiccup auto-claiming it
    // shouldn't undo that or block the response, same pattern as
    // AuthService.register linking a pending trip invitation.
    await this.businessesService
      .autoClaimSubmittedPlace(userId, saved, dto)
      .catch(() => undefined);
    await this.notifyAdminsOfPendingPlace(saved);

    return this.placeRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["category", "county"],
    });
  }

  /** Lets a submitter edit their own place — mirrors
   * BusinessesService.updateMine, including the same auto-resubmit-on-edit
   * behavior for a REJECTED place (an owner acting on reviewer feedback
   * shouldn't also have to find a separate "resubmit" button; SUSPENDED
   * deliberately does not auto-resubmit, same reasoning as businesses).
   * categoryId/countyId ARE self-service-editable (unlike slug/
   * ownerUserId, which stay admin-only via UpdatePlaceDto) — a submitter
   * needs to be able to fix a category/county picked wrong at submission
   * time, and requiring an admin for that correction was leaving
   * mis-filed places stuck wrong on the map and in search indefinitely. */
  async updateMine(
    userId: string,
    placeId: string,
    dto: UpdateMyPlaceDto,
  ): Promise<Place> {
    const place = await this.placeRepo.findOne({ where: { id: placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${placeId}" not found`);
    }
    if (place.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this place");
    }

    // `category`/`county` are `eager: true`, so the findOne() above already
    // populated them with the OLD relation — see clearStaleRelation's doc
    // comment for why leaving that in place would silently defeat the
    // categoryId/countyId merged below (TypeORM's save writes the FK
    // column from the *loaded relation object*, not the scalar, when both
    // are present). Same fix AdminContentService.updatePlace already
    // needed for the admin edit path.
    if (dto.categoryId !== undefined) clearStaleRelation(place, "category");
    if (dto.countyId !== undefined) clearStaleRelation(place, "county");

    Object.assign(place, dto);
    if (dto.openingHours !== undefined) {
      place.structuredHours = parseOpeningHoursText(dto.openingHours);
    }
    const isResubmission = place.reviewStatus === PlaceReviewStatus.REJECTED;
    if (isResubmission) {
      place.reviewStatus = PlaceReviewStatus.SUBMITTED_FOR_REVIEW;
      place.submittedAt = new Date();
      place.rejectionReason = null;
    }
    await this.placeRepo.save(place);
    if (isResubmission) {
      await this.notifyAdminsOfPendingPlace(place);
    }
    return this.placeRepo.findOneOrFail({
      where: { id: placeId },
      relations: ["category", "county"],
    });
  }

  /** GET /places/mine — a submitter's own places regardless of review
   * status, so they can track a pending submission or fix a rejected one
   * (findBySlug/findAll won't surface either — approved-only). */
  findMine(userId: string): Promise<Place[]> {
    return this.placeRepo.find({
      where: { ownerUserId: userId },
      relations: ["category", "county"],
      order: { createdAt: "DESC" },
    });
  }
}
