import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle, seconds } from "@nestjs/throttler";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { QueryReviewsDto } from "./dto/query-reviews.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Review } from "./entities/review.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitize(review: Review) {
  return { ...review, user: review.user ? toPublicUser(review.user) : null };
}

@ApiTags("Reviews")
@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  // One review per user per place is already enforced (ReviewsService), so
  // this is purely an anti-spam ceiling — well above what any real visitor
  // writing a handful of honest reviews in a sitting would ever hit.
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
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
