import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CarListing } from "./entities/car-listing.entity";
import { CarListingBlockedDate } from "./entities/car-listing-blocked-date.entity";
import { CarListingReviewStatus } from "./entities/car-listing.enums";
import { Business } from "../businesses/entities/business.entity";
import { County } from "../counties/entities/county.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";
import { CreateCarListingDto } from "./dto/create-car-listing.dto";
import { UpdateCarListingDto } from "./dto/update-car-listing.dto";
import { QueryCarListingsDto } from "./dto/query-car-listings.dto";
import { CreateCarListingBlockedDateDto } from "./dto/create-car-listing-blocked-date.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";

export interface CarListingAvailability {
  carListingId: string;
  unavailable: {
    startDate: string;
    endDate: string;
    source: "booking" | "blocked";
  }[];
}

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
    @InjectRepository(CarListingBlockedDate)
    private readonly blockedDateRepo: Repository<CarListingBlockedDate>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
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
      pricePerHour: dto.pricePerHour ?? null,
      minRentalHours: dto.pricePerHour ? (dto.minRentalHours ?? 1) : null,
      driverFeePerHour: dto.driverFeePerHour ?? null,
      securityDeposit: dto.securityDeposit ?? null,
      color: dto.color ?? null,
      mileageLimitPerDay: dto.mileageLimitPerDay ?? null,
      excessMileageFee: dto.excessMileageFee ?? null,
      fuelPolicy: dto.fuelPolicy ?? null,
      minDriverAge: dto.minDriverAge ?? null,
      additionalDriverAllowed: dto.additionalDriverAllowed ?? false,
      additionalDriverFee: dto.additionalDriverFee ?? null,
      insuranceIncluded: dto.insuranceIncluded ?? false,
      insuranceNotes: dto.insuranceNotes ?? null,
      cancellationPolicy: dto.cancellationPolicy ?? null,
      deliveryAvailable: dto.deliveryAvailable ?? false,
      deliveryFee: dto.deliveryFee ?? null,
      instantBookEnabled: dto.instantBookEnabled ?? false,
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

  /** Owner blocks a date range on their own listing (maintenance,
   * personal use, an off-platform rental) — excluded from availability
   * alongside CONFIRMED/PENDING bookings, see BookingsService.create's
   * overlap check and getAvailability below. No check against an
   * already-confirmed booking on the same range — an owner
   * double-blocking a date they've already confirmed is their own
   * mistake to notice, kept simple deliberately. */
  async createBlockedDate(
    userId: string,
    carListingId: string,
    dto: CreateCarListingBlockedDateDto,
  ): Promise<CarListingBlockedDate> {
    await this.findOwnedOrFail(userId, carListingId);
    if (new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException("endDate cannot be before startDate");
    }
    return this.blockedDateRepo.save(
      this.blockedDateRepo.create({
        carListingId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason ?? null,
      }),
    );
  }

  async findBlockedDates(
    userId: string,
    carListingId: string,
  ): Promise<CarListingBlockedDate[]> {
    await this.findOwnedOrFail(userId, carListingId);
    return this.blockedDateRepo.find({
      where: { carListingId },
      order: { startDate: "ASC" },
    });
  }

  async removeBlockedDate(
    userId: string,
    carListingId: string,
    blockedDateId: string,
  ): Promise<void> {
    await this.findOwnedOrFail(userId, carListingId);
    await this.blockedDateRepo.delete({
      id: blockedDateId,
      carListingId,
    });
  }

  /** Public — the merged set of date ranges a renter shouldn't bother
   * requesting, so the booking form can warn before a doomed submission.
   * Day-level granularity only (an HOUR-mode booking's whole calendar day
   * is reported unavailable here even though it only occupies part of
   * it) — this endpoint is advisory only; the real, hour-precise
   * enforcement lives in BookingsService.create's own overlap check.
   * `reason` is deliberately omitted from blocked-date entries — it may
   * hold a private note ("in the shop," "personal trip"). */
  async getAvailability(id: string): Promise<CarListingAvailability> {
    await this.findApprovedOne(id);

    const [bookings, blocks] = await Promise.all([
      this.bookingRepo.find({
        where: {
          carListingId: id,
          status: In([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
        },
      }),
      this.blockedDateRepo.find({ where: { carListingId: id } }),
    ]);

    return {
      carListingId: id,
      unavailable: [
        ...bookings.map((booking) => ({
          startDate: booking.requestedDate,
          endDate: booking.requestedEndDate ?? booking.requestedDate,
          source: "booking" as const,
        })),
        ...blocks.map((block) => ({
          startDate: block.startDate,
          endDate: block.endDate,
          source: "blocked" as const,
        })),
      ],
    };
  }
}
