import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { CreateAnalyticsEventDto } from "./dto/create-analytics-event.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Public, fire-and-forget from the frontend on page view / save /
   * contact-click / a successful booking request. Anonymous by design. */
  @Post("events")
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(@Body() dto: CreateAnalyticsEventDto) {
    await this.analyticsService.record(dto);
  }

  @Get("business/:businessId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getBusinessAnalytics(
    @CurrentUser() user: User,
    @Param("businessId") businessId: string,
  ) {
    return this.analyticsService.getBusinessAnalytics(user.id, businessId);
  }

  @Get("creator/:creatorId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getCreatorAnalytics(
    @CurrentUser() user: User,
    @Param("creatorId") creatorId: string,
  ) {
    return this.analyticsService.getCreatorAnalytics(user.id, creatorId);
  }

  @Get("advertisement/:advertisementId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getAdvertisementAnalytics(
    @CurrentUser() user: User,
    @Param("advertisementId") advertisementId: string,
  ) {
    return this.analyticsService.getAdvertisementAnalytics(
      user.id,
      advertisementId,
    );
  }
}
