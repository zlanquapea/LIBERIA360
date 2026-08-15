import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { QueryReviewsDto } from "./dto/query-reviews.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Review } from "./entities/review.entity";

function sanitize(review: Review) {
  return { ...review, user: review.user ? toPublicUser(review.user) : null };
}

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateReviewDto) {
    const review = await this.reviewsService.create(user.id, dto);
    return sanitize(review);
  }

  @Get()
  async findForPlace(@Query() query: QueryReviewsDto) {
    const result = await this.reviewsService.findForPlace(query);
    return { ...result, data: result.data.map(sanitize) };
  }
}
