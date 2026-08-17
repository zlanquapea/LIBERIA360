import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Review } from "./entities/review.entity";
import { Place } from "../places/entities/place.entity";
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
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    const place = await this.placeRepo.findOne({ where: { id: dto.placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }

    const existing = await this.reviewRepo.findOne({
      where: { userId, placeId: dto.placeId },
    });
    if (existing) {
      throw new ConflictException("You have already reviewed this place");
    }

    const verifiedVisit = await this.hasConfirmedBooking(userId, dto.placeId);

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({ ...dto, userId, verifiedVisit }),
    );
    await this.recalculatePlaceRating(dto.placeId);
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
   * place's rating/reviewCount so it never reflects a removed review. */
  async remove(id: string): Promise<void> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException(`Review "${id}" not found`);
    }
    await this.reviewRepo.delete({ id });
    await this.recalculatePlaceRating(review.placeId);
  }

  async findForPlace(query: QueryReviewsDto): Promise<PaginatedReviews> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [data, total] = await this.reviewRepo.findAndCount({
      where: { placeId: query.placeId },
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
}
