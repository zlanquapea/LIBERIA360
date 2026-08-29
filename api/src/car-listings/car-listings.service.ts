import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CarListing } from "./entities/car-listing.entity";
import { CarListingReviewStatus } from "./entities/car-listing.enums";
import { Business } from "../businesses/entities/business.entity";
import { County } from "../counties/entities/county.entity";
import { CreateCarListingDto } from "./dto/create-car-listing.dto";
import { UpdateCarListingDto } from "./dto/update-car-listing.dto";
import { QueryCarListingsDto } from "./dto/query-car-listings.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";

export interface PaginatedCarListings {
  data: CarListing[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

/** Same non-route as AD_MODERATION_QUEUE_LINK — the pending-review queue
 * lives on the shared admin moderation dashboard, not a route of its
 * own. */
const CAR_LISTING_MODERATION_QUEUE_LINK = "/admin/content/moderation";

@Injectable()
export class CarListingsService {
  constructor(
    @InjectRepository(CarListing)
    private readonly carListingRepo: Repository<CarListing>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(County)
    private readonly countyRepo: Repository<County>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  private async notifyAdminsOfPendingListing(
    listing: CarListing,
  ): Promise<void> {
    const adminIds = await this.usersService.findAdminIds();
    await this.notificationsService.createMany(adminIds, {
      type: "admin.car_listing_pending_review",
      title: "Car listing pending review",
      body: `"${listing.title}" is waiting for a review decision.`,
      link: CAR_LISTING_MODERATION_QUEUE_LINK,
    });
  }

  /** The optional business link (see CarListing's doc comment) must
   * actually belong to whoever is listing the car — there's no
   * requirement it be type CAR_RENTAL or even approved, since linking it
   * is just "also show this on my business's page," not a prerequisite
   * to list at all. */
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

  private async assertCountyExists(countyId: string): Promise<void> {
    const exists = await this.countyRepo.exists({ where: { id: countyId } });
    if (!exists) {
      throw new BadRequestException(`County "${countyId}" not found`);
    }
  }

  /** Self-service submission — single step, straight to
   * SUBMITTED_FOR_REVIEW, mirroring AdvertisementsService.create: any
   * signed-in user can list a car, same as advertising anything else on
   * this platform — no Business or Place required first. Not publicly
   * visible or bookable until an admin approves it. */
  async create(userId: string, dto: CreateCarListingDto): Promise<CarListing> {
    await this.assertCountyExists(dto.countyId);
    if (dto.businessId) {
      await this.assertOwnsBusiness(userId, dto.businessId);
    }

    const listing = this.carListingRepo.create({
      ownerUserId: userId,
      businessId: dto.businessId ?? null,
      countyId: dto.countyId,
      title: dto.title,
      make: dto.make,
      model: dto.model,
      year: dto.year,
      category: dto.category,
      transmission: dto.transmission,
      fuelType: dto.fuelType,
      seats: dto.seats,
      pricePerDay: dto.pricePerDay,
      withDriverAvailable: dto.withDriverAvailable ?? false,
      driverFeePerDay: dto.driverFeePerDay ?? null,
      minRentalDays: dto.minRentalDays ?? 1,
      securityDeposit: dto.securityDeposit ?? null,
      features: dto.features ?? [],
      images: dto.images ?? [],
      description: dto.description ?? null,
      pickupLocation: dto.pickupLocation ?? null,
      contactPhone: dto.contactPhone ?? null,
      contactWhatsapp: dto.contactWhatsapp ?? null,
      reviewStatus: CarListingReviewStatus.SUBMITTED_FOR_REVIEW,
      submittedAt: new Date(),
    });
    const saved = await this.carListingRepo.save(listing);
    await this.notifyAdminsOfPendingListing(saved);
    return this.carListingRepo.findOneOrFail({ where: { id: saved.id } });
  }

  private async findOwnedOrFail(
    userId: string,
    id: string,
  ): Promise<CarListing> {
    const listing = await this.carListingRepo.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Car listing "${id}" not found`);
    }
    if (listing.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this car listing");
    }
    return listing;
  }

  /** The owner's own fleet dashboard — every status, not just approved,
   * so a pending/rejected/suspended vehicle is still visible to whoever
   * listed it. Plain find(): owner/business/county are all `eager: true`
   * so they auto-join here (unlike a query builder — see
   * findAllApproved's doc comment). */
  findMine(userId: string): Promise<CarListing[]> {
    return this.carListingRepo.find({
      where: { ownerUserId: userId },
      order: { createdAt: "DESC" },
    });
  }

  findOne(userId: string, id: string): Promise<CarListing> {
    return this.findOwnedOrFail(userId, id);
  }

  /** Editing a REJECTED listing resubmits it automatically — same
   * reasoning as AdvertisementsService.update. A SUSPENDED listing does
   * NOT auto-resubmit: lifting a suspension is an explicit admin action.
   * Toggling `isActive` alone never touches `reviewStatus` either way —
   * pausing a car for a while isn't "changing the listing" in the sense
   * that should cost an owner their approval. */
  async update(
    userId: string,
    id: string,
    dto: UpdateCarListingDto,
  ): Promise<CarListing> {
    const listing = await this.findOwnedOrFail(userId, id);
    if (dto.countyId) {
      await this.assertCountyExists(dto.countyId);
    }
    const isResubmission =
      listing.reviewStatus === CarListingReviewStatus.REJECTED;

    Object.assign(listing, dto);
    if (isResubmission) {
      listing.reviewStatus = CarListingReviewStatus.SUBMITTED_FOR_REVIEW;
      listing.submittedAt = new Date();
      listing.rejectionReason = null;
    }
    await this.carListingRepo.save(listing);
    if (isResubmission) {
      await this.notifyAdminsOfPendingListing(listing);
    }
    return this.carListingRepo.findOneOrFail({ where: { id } });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwnedOrFail(userId, id);
    await this.carListingRepo.delete({ id });
  }

  /** Public directory (GET /car-listings) — approved AND currently active
   * only, the same "is this actually visible/bookable right now" gate as
   * findApprovedOne. Query builder, not find(): owner/business/county are
   * `eager: true` but eager relations only auto-join through find()/
   * findAndCount(), not a query builder (see BusinessesService.
   * findAllApproved for the same pattern). */
  async findAllApproved(
    params: QueryCarListingsDto = {},
  ): Promise<PaginatedCarListings> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const qb = this.carListingRepo
      .createQueryBuilder("listing")
      .leftJoinAndSelect("listing.owner", "owner")
      .leftJoinAndSelect("listing.business", "business")
      .leftJoinAndSelect("listing.county", "county")
      .where("listing.reviewStatus = :reviewStatus", {
        reviewStatus: CarListingReviewStatus.APPROVED,
      })
      .andWhere("listing.isActive = true")
      .orderBy("listing.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (params.search) {
      qb.andWhere(
        "(listing.title ILIKE :search OR listing.make ILIKE :search OR listing.model ILIKE :search)",
        { search: `%${params.search}%` },
      );
    }
    if (params.category) {
      qb.andWhere("listing.category = :category", {
        category: params.category,
      });
    }
    if (params.transmission) {
      qb.andWhere("listing.transmission = :transmission", {
        transmission: params.transmission,
      });
    }
    if (params.countyId) {
      qb.andWhere("listing.countyId = :countyId", {
        countyId: params.countyId,
      });
    }
    if (params.minSeats != null) {
      qb.andWhere("listing.seats >= :minSeats", { minSeats: params.minSeats });
    }
    if (params.maxPricePerDay != null) {
      qb.andWhere("listing.pricePerDay <= :maxPricePerDay", {
        maxPricePerDay: params.maxPricePerDay,
      });
    }
    if (params.withDriverAvailable) {
      qb.andWhere("listing.withDriverAvailable = true");
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

  /** Public detail page — approved AND active only, same visibility rule
   * as findAllApproved, so a listing that's pending/rejected/suspended or
   * paused by its own owner isn't reachable by guessing its id. */
  async findApprovedOne(id: string): Promise<CarListing> {
    const listing = await this.carListingRepo.findOne({
      where: {
        id,
        reviewStatus: CarListingReviewStatus.APPROVED,
        isActive: true,
      },
    });
    if (!listing) {
      throw new NotFoundException(`Car listing "${id}" not found`);
    }
    return listing;
  }
}
