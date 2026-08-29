import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Review } from "./entities/review.entity";
import { Place } from "../places/entities/place.entity";
import { Creator } from "../creators/entities/creator.entity";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";
import { CreateReviewDto } from "./dto/create-review.dto";
import { QueryReviewsDto } from "./dto/query-reviews.dto";

export interface PaginatedReviews {
  data: Review[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(CarListing)
    private readonly carListingRepo: Repository<CarListing>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    const targetCount = [dto.placeId, dto.creatorId, dto.carListingId].filter(
      Boolean,
    ).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        "Provide exactly one of placeId, creatorId, or carListingId",
      );
    }

    if (dto.placeId) {
      return this.createForPlace(userId, dto.placeId, dto);
    }
    if (dto.creatorId) {
      return this.createForCreator(userId, dto.creatorId, dto);
    }
    return this.createForCarListing(userId, dto.carListingId!, dto);
  }

  private async createForPlace(
    userId: string,
    placeId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const place = await this.placeRepo.findOne({ where: { id: placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${placeId}" not found`);
    }

    const existing = await this.reviewRepo.findOne({
      where: { userId, placeId },
    });
    if (existing) {
      throw new ConflictException("You have already reviewed this place");
    }

    const verifiedVisit = await this.hasConfirmedBooking(
      "business.linkedPlaceId",
      placeId,
      userId,
    );

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({ ...dto, userId, placeId, verifiedVisit }),
    );
    await this.recalculatePlaceRating(placeId);
    return this.reviewRepo.findOneOrFail({
      where: { id: review.id },
      relations: ["user"],
    });
  }

  private async createForCreator(
    userId: string,
    creatorId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const creator = await this.creatorRepo.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException(`Creator "${creatorId}" not found`);
    }

    const existing = await this.reviewRepo.findOne({
      where: { userId, creatorId },
    });
    if (existing) {
      throw new ConflictException("You have already reviewed this creator");
    }

    // No booking data links a reviewer to a creator yet (see the [Later
    // phase] task extending Booking to creators) — always false for now,
    // same starting point Place reviews had before Bookings existed.
    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        ...dto,
        userId,
        creatorId,
        verifiedVisit: false,
      }),
    );
    await this.recalculateCreatorRating(creatorId);
    return this.reviewRepo.findOneOrFail({
      where: { id: review.id },
      relations: ["user"],
    });
  }

  private async createForCarListing(
    userId: string,
    carListingId: string,
    dto: CreateReviewDto,
  ): Promise<Review> {
    const carListing = await this.carListingRepo.findOne({
      where: { id: carListingId },
    });
    if (!carListing) {
      throw new NotFoundException(`Car listing "${carListingId}" not found`);
    }

    const existing = await this.reviewRepo.findOne({
      where: { userId, carListingId },
    });
    if (existing) {
      throw new ConflictException("You have already reviewed this car");
    }

    const verifiedVisit = await this.hasConfirmedBooking(
      "booking.carListingId",
      carListingId,
      userId,
    );

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({
        ...dto,
        userId,
        carListingId,
        verifiedVisit,
      }),
    );
    await this.recalculateCarListingRating(carListingId);
    return this.reviewRepo.findOneOrFail({
      where: { id: review.id },
      relations: ["user"],
    });
  }

  /** See Review.verifiedVisit's doc comment for what this signal does and
   * doesn't mean. `matchColumn` is either the joined business's
   * linkedPlaceId (for a place review) or the booking's own
   * carListingId (for a car review) — the two shapes a "did this person
   * actually book the thing they're reviewing" check takes. */
  private async hasConfirmedBooking(
    matchColumn: "business.linkedPlaceId" | "booking.carListingId",
    matchValue: string,
    userId: string,
  ): Promise<boolean> {
    const qb = this.bookingRepo
      .createQueryBuilder("booking")
      .where("booking.guestUserId = :userId", { userId })
      .andWhere("booking.status = :status", {
        status: BookingStatus.CONFIRMED,
      });
    if (matchColumn === "business.linkedPlaceId") {
      qb.innerJoin("booking.business", "business").andWhere(
        `${matchColumn} = :matchValue`,
        { matchValue },
      );
    } else {
      qb.andWhere(`${matchColumn} = :matchValue`, { matchValue });
    }
    return (await qb.getCount()) > 0;
  }

  /** Admin removal (moderation) — deletes the review and recomputes the
   * target's rating/reviewCount so it never reflects a removed review. */
  async remove(id: string): Promise<void> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException(`Review "${id}" not found`);
    }
    await this.reviewRepo.delete({ id });
    if (review.placeId) {
      await this.recalculatePlaceRating(review.placeId);
    } else if (review.creatorId) {
      await this.recalculateCreatorRating(review.creatorId);
    } else if (review.carListingId) {
      await this.recalculateCarListingRating(review.carListingId);
    }
  }

  async find(query: QueryReviewsDto): Promise<PaginatedReviews> {
    const targetCount = [
      query.placeId,
      query.creatorId,
      query.carListingId,
    ].filter(Boolean).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        "Provide exactly one of placeId, creatorId, or carListingId",
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where = query.placeId
      ? { placeId: query.placeId }
      : query.creatorId
        ? { creatorId: query.creatorId }
        : { carListingId: query.carListingId };

    const [data, total] = await this.reviewRepo.findAndCount({
      where,
      relations: ["user"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

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

  /** Recomputes Place.rating/reviewCount from the reviews table — kept as
   * the single source of truth rather than incrementally maintained, so it
   * can never drift out of sync. */
  private async recalculatePlaceRating(placeId: string): Promise<void> {
    const { avg, count } = await this.reviewRepo
      .createQueryBuilder("review")
      .select("AVG(review.overallRating)", "avg")
      .addSelect("COUNT(*)", "count")
      .where("review.placeId = :placeId", { placeId })
      .getRawOne();

    await this.placeRepo.update(placeId, {
      rating: Math.round(parseFloat(avg) * 10) / 10,
      reviewCount: parseInt(count, 10),
    });
  }

  /** Same convention as recalculatePlaceRating, for Creator.rating/
   * reviewCount. */
  private async recalculateCreatorRating(creatorId: string): Promise<void> {
    const { avg, count } = await this.reviewRepo
      .createQueryBuilder("review")
      .select("AVG(review.overallRating)", "avg")
      .addSelect("COUNT(*)", "count")
      .where("review.creatorId = :creatorId", { creatorId })
      .getRawOne();

    await this.creatorRepo.update(creatorId, {
      rating: Math.round(parseFloat(avg) * 10) / 10,
      reviewCount: parseInt(count, 10),
    });
  }

  /** Same convention as recalculatePlaceRating, for CarListing.rating/
   * reviewCount. */
  private async recalculateCarListingRating(
    carListingId: string,
  ): Promise<void> {
    const { avg, count } = await this.reviewRepo
      .createQueryBuilder("review")
      .select("AVG(review.overallRating)", "avg")
      .addSelect("COUNT(*)", "count")
      .where("review.carListingId = :carListingId", { carListingId })
      .getRawOne();

    await this.carListingRepo.update(carListingId, {
      rating: Math.round(parseFloat(avg) * 10) / 10,
      reviewCount: parseInt(count, 10),
    });
  }
}
