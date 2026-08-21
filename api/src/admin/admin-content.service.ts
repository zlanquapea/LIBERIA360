import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { PlaceReviewStatus } from "../places/entities/place.enums";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Business } from "../businesses/entities/business.entity";
import {
  BusinessReviewStatus,
  BusinessType,
} from "../businesses/entities/business.enums";
import { buildBusinessSlug } from "../businesses/businesses.service";
import { Event } from "../events/entities/event.entity";
import { CreatePlaceDto } from "./dto/create-place.dto";
import { UpdatePlaceDto } from "./dto/update-place.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { CreateBusinessAdminDto } from "./dto/create-business-admin.dto";
import { UpdateBusinessAdminDto } from "./dto/update-business-admin.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateCountyDto } from "./dto/update-county.dto";
import { ReviewsService } from "../reviews/reviews.service";
import { AdminAuditService } from "./admin-audit.service";
import { RequestInfo } from "../common/request-info";
import { clearStaleRelation } from "../common/typeorm-relations";

/** Admin content management (Tech Spec §8) — create/edit Place, Category,
 * Business, Activity, and Event records. The first way to write to the
 * catalog through the API at all; Phase 1/2 only ever read it (seeded via
 * scripts). Deliberately self-contained (direct repo access, not routed
 * through PlacesService/BusinessesService/EventsService) so this module
 * can't regress any existing Phase 1/2 read/write path — the one
 * exception is `deleteReview`, which goes through `ReviewsService` so
 * removal reuses the same rating-recalculation logic review creation
 * uses, instead of duplicating that query here. */
@Injectable()
export class AdminContentService {
  constructor(
    @InjectRepository(Place) private readonly placeRepo: Repository<Place>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(County) private readonly countyRepo: Repository<County>,
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    private readonly reviewsService: ReviewsService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  // ---- Places ----

  // Every place regardless of review status (unlike the public GET
  // /places, which is approved-only) — the admin Places list/moderation
  // queue needs to see pending/rejected/suspended submissions too. Query
  // builder with an explicit `owner` join, not find(): Place deliberately
  // has no eager `owner` relation (see Place.ownerUserId's doc comment on
  // why), and the admin moderation UI is exactly the one place that does
  // need to show who submitted a pending place — same reasoning as
  // findBusinesses' `owner` join above.
  async findPlaces(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      reviewStatus?: PlaceReviewStatus;
    } = {},
  ): Promise<{
    data: Place[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const qb = this.placeRepo
      .createQueryBuilder("place")
      .leftJoinAndSelect("place.category", "category")
      .leftJoinAndSelect("place.county", "county")
      .leftJoinAndSelect("place.owner", "owner")
      .orderBy("place.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (params.search) {
      qb.andWhere(
        "(place.name ILIKE :search OR place.description ILIKE :search)",
        {
          search: `%${params.search}%`,
        },
      );
    }
    if (params.reviewStatus) {
      qb.andWhere("place.reviewStatus = :reviewStatus", {
        reviewStatus: params.reviewStatus,
      });
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

  // Single-place admin fetch by id (not slug) — works regardless of
  // review status, unlike the public PlacesService.findBySlug. Used by the
  // admin detail/review view, which navigates by id rather than a slug a
  // pending submission may not even have settled yet.
  async findPlaceById(id: string): Promise<Place> {
    const place = await this.placeRepo.findOne({
      where: { id },
      relations: ["category", "county", "activities", "owner"],
    });
    if (!place) {
      throw new NotFoundException(`Place "${id}" not found`);
    }
    return place;
  }

  async createPlace(dto: CreatePlaceDto): Promise<Place> {
    await this.assertCategoryExists(dto.categoryId);
    await this.assertCountyExists(dto.countyId);

    const existingSlug = await this.placeRepo.exists({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }

    const place = await this.placeRepo.save(this.placeRepo.create(dto));
    return this.placeRepo.findOneOrFail({ where: { id: place.id } });
  }

  async updatePlace(id: string, dto: UpdatePlaceDto): Promise<Place> {
    const place = await this.placeRepo.findOne({ where: { id } });
    if (!place) {
      throw new NotFoundException(`Place "${id}" not found`);
    }
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
      // `category` is `eager: true`, so the findOne() above already
      // populated it with the OLD category — see clearStaleRelation's doc
      // comment for why that silently defeats the categoryId merged below
      // if left in place.
      clearStaleRelation(place, "category");
    }
    if (dto.countyId) {
      await this.assertCountyExists(dto.countyId);
      clearStaleRelation(place, "county");
    }
    if (dto.slug && dto.slug !== place.slug) {
      const existingSlug = await this.placeRepo.exists({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new ConflictException(`Slug "${dto.slug}" is already in use`);
      }
    }

    this.placeRepo.merge(place, dto);
    await this.placeRepo.save(place);
    return this.placeRepo.findOneOrFail({ where: { id } });
  }

  async deletePlace(
    adminUserId: string,
    id: string,
    requestInfo?: RequestInfo,
  ): Promise<void> {
    const place = await this.placeRepo.findOne({ where: { id } });
    if (!place) {
      throw new NotFoundException(`Place "${id}" not found`);
    }
    // Activities/reviews/analytics events/sponsored placements/freshness
    // reports all cascade-delete with the place (see the migrations) — but
    // a linked business or an event held at this place doesn't, on
    // purpose: silently deleting someone's business listing, or orphaning
    // an event's venue, is worse than asking the admin to handle those
    // first. Checked explicitly for a clear message; deleteOrConflict
    // below is the safety net for any FK this doesn't anticipate.
    const hasBusiness = await this.businessRepo.exists({
      where: { linkedPlaceId: id },
    });
    if (hasBusiness) {
      throw new ConflictException(
        "This place has a linked business — remove or reassign it first",
      );
    }
    const hasEvents = await this.eventRepo.exists({ where: { placeId: id } });
    if (hasEvents) {
      throw new ConflictException(
        "This place has events at this location — remove or reassign them first",
      );
    }

    await this.deleteOrConflict(
      () => this.placeRepo.delete({ id }),
      "This place is still referenced elsewhere and can't be deleted",
    );
    await this.adminAuditService.log(
      adminUserId,
      "place.removed",
      "place",
      id,
      { name: place.name, slug: place.slug },
      requestInfo,
    );
  }

  // ---- Categories ----

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const existingSlug = await this.categoryRepo.exists({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException(`Slug "${dto.slug}" is already in use`);
    }
    const category = await this.categoryRepo.save(
      this.categoryRepo.create(dto),
    );
    return this.categoryRepo.findOneOrFail({ where: { id: category.id } });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category "${id}" not found`);
    }
    if (dto.slug && dto.slug !== category.slug) {
      const existingSlug = await this.categoryRepo.exists({
        where: { slug: dto.slug },
      });
      if (existingSlug) {
        throw new ConflictException(`Slug "${dto.slug}" is already in use`);
      }
    }
    this.categoryRepo.merge(category, dto);
    await this.categoryRepo.save(category);
    return this.categoryRepo.findOneOrFail({ where: { id } });
  }

  async deleteCategory(
    adminUserId: string,
    id: string,
    requestInfo?: RequestInfo,
  ): Promise<void> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category "${id}" not found`);
    }
    const inUse = await this.placeRepo.exists({ where: { categoryId: id } });
    if (inUse) {
      throw new ConflictException(
        "This category is still used by one or more places — move them to a different category first",
      );
    }

    await this.deleteOrConflict(
      () => this.categoryRepo.delete({ id }),
      "This category is still referenced elsewhere and can't be deleted",
    );
    await this.adminAuditService.log(
      adminUserId,
      "category.removed",
      "category",
      id,
      { name: category.name, slug: category.slug },
      requestInfo,
    );
  }

  // ---- Activities ----

  async createActivity(dto: CreateActivityDto): Promise<Activity> {
    const placeExists = await this.placeRepo.exists({
      where: { id: dto.placeId },
    });
    if (!placeExists) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }
    const activity = await this.activityRepo.save(
      this.activityRepo.create(dto),
    );
    return this.activityRepo.findOneOrFail({ where: { id: activity.id } });
  }

  async updateActivity(id: string, dto: UpdateActivityDto): Promise<Activity> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) {
      throw new NotFoundException(`Activity "${id}" not found`);
    }
    this.activityRepo.merge(activity, dto);
    await this.activityRepo.save(activity);
    return this.activityRepo.findOneOrFail({ where: { id } });
  }

  // Nothing references an activity by FK, so this is a plain delete — no
  // exists()-checks needed, just the existence check for a clean 404.
  async deleteActivity(
    adminUserId: string,
    id: string,
    requestInfo?: RequestInfo,
  ): Promise<void> {
    const activity = await this.activityRepo.findOne({ where: { id } });
    if (!activity) {
      throw new NotFoundException(`Activity "${id}" not found`);
    }
    await this.activityRepo.delete({ id });
    await this.adminAuditService.log(
      adminUserId,
      "activity.removed",
      "activity",
      id,
      { name: activity.name, placeId: activity.placeId },
      requestInfo,
    );
  }

  // ---- Businesses ----

  /** Admin Business Management list — every business regardless of review
   * status (query builder, not find(): owner/linkedPlace are `eager: true`
   * on Business but eager relations only auto-join through find*()
   * methods, not a query builder — same gotcha as
   * BusinessesService.findAllApproved/CreatorsService.findAll). */
  async findBusinesses(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      reviewStatus?: BusinessReviewStatus;
      type?: BusinessType;
      reportedOnly?: boolean;
    } = {},
  ): Promise<{
    data: Business[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const qb = this.businessRepo
      .createQueryBuilder("business")
      .leftJoinAndSelect("business.owner", "owner")
      .leftJoinAndSelect("business.linkedPlace", "linkedPlace")
      .leftJoinAndSelect("linkedPlace.category", "category")
      .leftJoinAndSelect("linkedPlace.county", "county")
      .orderBy("business.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (params.search) {
      qb.andWhere(
        "(business.name ILIKE :search OR business.description ILIKE :search)",
        { search: `%${params.search}%` },
      );
    }
    if (params.reviewStatus) {
      qb.andWhere("business.reviewStatus = :reviewStatus", {
        reviewStatus: params.reviewStatus,
      });
    }
    if (params.type) {
      qb.andWhere("business.type = :type", { type: params.type });
    }
    if (params.reportedOnly) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM content_reports cr WHERE cr.target_type = 'business' AND cr.target_id = business.id)`,
      );
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

  async createBusiness(dto: CreateBusinessAdminDto): Promise<Business> {
    const place = await this.placeRepo.findOne({
      where: { id: dto.placeId },
    });
    if (!place) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }
    const existing = await this.businessRepo.exists({
      where: { linkedPlaceId: dto.placeId },
    });
    if (existing) {
      throw new ConflictException("A business is already linked to this place");
    }

    const business = await this.businessRepo.save(
      this.businessRepo.create({
        name: dto.name,
        slug: await buildBusinessSlug(this.businessRepo, dto.name),
        type: dto.type,
        ownerUserId: dto.ownerUserId ?? null,
        linkedPlaceId: dto.placeId,
        phone: dto.phone ?? null,
        whatsapp: dto.whatsapp ?? null,
        email: dto.email ?? null,
        website: dto.website ?? null,
        socialLinks: dto.socialLinks ?? [],
        description: dto.description ?? null,
        images: dto.images ?? [],
        logoImage: dto.logoImage ?? null,
        videos: dto.videos ?? [],
        openingHours: dto.openingHours ?? null,
        priceRangeMin: dto.priceRangeMin ?? null,
        priceRangeMax: dto.priceRangeMax ?? null,
        servicesOffered: dto.servicesOffered ?? [],
        // Admin-authored directly, not a self-claim — an admin doesn't
        // need to review their own work before it goes live (see
        // BusinessReviewStatus's doc comment).
        reviewStatus: BusinessReviewStatus.APPROVED,
      }),
    );
    return this.businessRepo.findOneOrFail({ where: { id: business.id } });
  }

  async updateBusiness(
    id: string,
    dto: UpdateBusinessAdminDto,
  ): Promise<Business> {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException(`Business "${id}" not found`);
    }
    if (dto.ownerUserId !== undefined) {
      // `owner` is `eager: true` — see clearStaleRelation's doc comment;
      // without this, reassigning or clearing ownerUserId silently no-ops.
      clearStaleRelation(business, "owner");
    }
    this.businessRepo.merge(business, dto);
    await this.businessRepo.save(business);
    return this.businessRepo.findOneOrFail({ where: { id } });
  }

  // Bookings (and booking_messages, transitively) cascade-delete with the
  // business — no pre-check needed beyond existence.
  async deleteBusiness(
    adminUserId: string,
    id: string,
    requestInfo?: RequestInfo,
  ): Promise<void> {
    const business = await this.businessRepo.findOne({ where: { id } });
    if (!business) {
      throw new NotFoundException(`Business "${id}" not found`);
    }
    await this.businessRepo.delete({ id });
    await this.adminAuditService.log(
      adminUserId,
      "business.removed",
      "business",
      id,
      { name: business.name, linkedPlaceId: business.linkedPlaceId },
      requestInfo,
    );
  }

  // ---- Events ----

  async updateEvent(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event "${id}" not found`);
    }

    const nextPlaceId = dto.placeId ?? event.placeId;
    const nextLocationText = dto.locationText ?? event.locationText;
    if (!nextPlaceId && !nextLocationText) {
      throw new BadRequestException(
        "Provide either placeId or locationText for the event location",
      );
    }
    const nextStart = dto.startDate ?? event.startDate.toISOString();
    const nextEnd = dto.endDate ?? event.endDate?.toISOString();
    if (nextEnd && new Date(nextEnd) < new Date(nextStart)) {
      throw new BadRequestException("endDate cannot be before startDate");
    }

    // `place`/`county` are both `eager: true` — see clearStaleRelation's
    // doc comment; without this, reassigning placeId/countyId silently
    // no-ops.
    if (dto.placeId) clearStaleRelation(event, "place");
    if (dto.countyId) clearStaleRelation(event, "county");

    this.eventRepo.merge(event, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
    await this.eventRepo.save(event);
    return this.eventRepo.findOneOrFail({ where: { id } });
  }

  async deleteEvent(
    adminUserId: string,
    id: string,
    requestInfo?: RequestInfo,
  ): Promise<void> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event "${id}" not found`);
    }
    await this.eventRepo.delete({ id });
    await this.adminAuditService.log(
      adminUserId,
      "event.removed",
      "event",
      id,
      { name: event.name },
      requestInfo,
    );
  }

  // ---- Reviews ----

  async deleteReview(
    adminUserId: string,
    id: string,
    requestInfo?: RequestInfo,
  ): Promise<void> {
    await this.reviewsService.remove(id);
    await this.adminAuditService.log(
      adminUserId,
      "review.removed",
      "review",
      id,
      undefined,
      requestInfo,
    );
  }

  // ---- Counties (safety & practical-info panel only — see UpdateCountyDto) ----

  async updateCounty(id: string, dto: UpdateCountyDto): Promise<County> {
    const county = await this.countyRepo.findOne({ where: { id } });
    if (!county) {
      throw new NotFoundException(`County "${id}" not found`);
    }
    this.countyRepo.merge(county, dto);
    await this.countyRepo.save(county);
    return this.countyRepo.findOneOrFail({ where: { id } });
  }

  // Liberia has a fixed 15 counties — this exists for completeness (a
  // genuine data-entry mistake while adding one) rather than routine use.
  // Places and events referencing a county block the delete explicitly;
  // deleteOrConflict catches anything else (e.g. a user's home county).
  async deleteCounty(
    adminUserId: string,
    id: string,
    requestInfo?: RequestInfo,
  ): Promise<void> {
    const county = await this.countyRepo.findOne({ where: { id } });
    if (!county) {
      throw new NotFoundException(`County "${id}" not found`);
    }
    const hasPlaces = await this.placeRepo.exists({ where: { countyId: id } });
    if (hasPlaces) {
      throw new ConflictException(
        "This county still has places in it — move or remove them first",
      );
    }
    const hasEvents = await this.eventRepo.exists({
      where: { countyId: id },
    });
    if (hasEvents) {
      throw new ConflictException(
        "This county still has events in it — move or remove them first",
      );
    }

    await this.deleteOrConflict(
      () => this.countyRepo.delete({ id }),
      "This county is still referenced elsewhere and can't be deleted",
    );
    await this.adminAuditService.log(
      adminUserId,
      "county.removed",
      "county",
      id,
      { name: county.name, slug: county.slug },
      requestInfo,
    );
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const exists = await this.categoryRepo.exists({
      where: { id: categoryId },
    });
    if (!exists) {
      throw new NotFoundException(`Category "${categoryId}" not found`);
    }
  }

  private async assertCountyExists(countyId: string): Promise<void> {
    const exists = await this.countyRepo.exists({ where: { id: countyId } });
    if (!exists) {
      throw new NotFoundException(`County "${countyId}" not found`);
    }
  }

  // TypeORM wraps the driver error; Postgres reports a foreign-key
  // violation as code 23503. This turns that into a clear 409 instead of a
  // raw 500 — the explicit exists()-checks above cover the common,
  // expected blockers with a specific message; this is the safety net for
  // any relationship this service doesn't explicitly check for.
  private async deleteOrConflict(
    action: () => Promise<unknown>,
    conflictMessage: string,
  ): Promise<void> {
    try {
      await action();
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as QueryFailedError & { code?: string }).code === "23503"
      ) {
        throw new ConflictException(conflictMessage);
      }
      throw err;
    }
  }
}
