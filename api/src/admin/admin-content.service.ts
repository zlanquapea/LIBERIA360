import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { Category } from "../categories/entities/category.entity";
import { County } from "../counties/entities/county.entity";
import { Activity } from "../activities/entities/activity.entity";
import { Business } from "../businesses/entities/business.entity";
import { Event } from "../events/entities/event.entity";
import { CreatePlaceDto } from "./dto/create-place.dto";
import { UpdatePlaceDto } from "./dto/update-place.dto";
import { CreateActivityDto } from "./dto/create-activity.dto";
import { UpdateActivityDto } from "./dto/update-activity.dto";
import { CreateBusinessAdminDto } from "./dto/create-business-admin.dto";
import { UpdateBusinessAdminDto } from "./dto/update-business-admin.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateCountyDto } from "./dto/update-county.dto";
import { ReviewsService } from "../reviews/reviews.service";
import { AdminAuditService } from "./admin-audit.service";
import { RequestInfo } from "../common/request-info";

/** Admin content management (Tech Spec §8) — create/edit Place, Business,
 * Activity, and Event records. The first way to write to the catalog
 * through the API at all; Phase 1/2 only ever read it (seeded via
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
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId);
    if (dto.countyId) await this.assertCountyExists(dto.countyId);
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

  // ---- Businesses ----

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
    this.businessRepo.merge(business, dto);
    await this.businessRepo.save(business);
    return this.businessRepo.findOneOrFail({ where: { id } });
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
}
