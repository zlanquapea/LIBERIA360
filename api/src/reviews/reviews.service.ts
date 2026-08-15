import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Review } from "./entities/review.entity";
import { Place } from "../places/entities/place.entity";
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

    const review = await this.reviewRepo.save(
      this.reviewRepo.create({ ...dto, userId }),
    );
    await this.recalculatePlaceRating(dto.placeId);
    return this.reviewRepo.findOneOrFail({
      where: { id: review.id },
      relations: ["user"],
    });
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
