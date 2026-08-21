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
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    if (!dto.placeId === !dto.creatorId) {
      throw new BadRequestException(
        "Provide exactly one of placeId or creatorId",
      );
    }

    if (dto.placeId) {
      return this.createForPlace(userId, dto.placeId, dto);
    }
    return this.createForCreator(userId, dto.creatorId!, dto);
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

    const verifiedVisit = await this.hasConfirmedBooking(userId, placeId);

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

  /** See Review.verifiedVisit's doc comment for what this signal does and
   * doesn't mean. */
  private async hasConfirmedBooking(
    userId: string,
    placeId: string,
  ): Promise<boolean> {
    const count = await this.bookingRepo
      .createQueryBuilder("booking")
      .innerJoin("booking.business", "business")
      .where("booking.guestUserId = :userId", { userId })
      .andWhere("business.linkedPlaceId = :placeId", { placeId })
      .andWhere("booking.status = :status", { status: BookingStatus.CONFIRMED })
      .getCount();
    return count > 0;
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
    }
  }

  async find(query: QueryReviewsDto): Promise<PaginatedReviews> {
    if (!query.placeId === !query.creatorId) {
      throw new BadRequestException(
        "Provide exactly one of placeId or creatorId",
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [data, total] = await this.reviewRepo.findAndCount({
      where: query.placeId
        ? { placeId: query.placeId }
        : { creatorId: query.creatorId },
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
}
