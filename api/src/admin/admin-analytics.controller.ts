import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminAnalyticsService } from "./admin-analytics.service";
import { QueryAggregateAnalyticsDto } from "./dto/query-aggregate-analytics.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Admin Analytics")
@Controller("admin/analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get("aggregate")
  getAggregate(@Query() query: QueryAggregateAnalyticsDto) {
    return this.adminAnalyticsService.getAggregate(query.limit);
  }

  // Any admin, same as /aggregate — internal decision-making view over
  // the same underlying event/user/review/booking data, not additional
  // sensitive exposure.
  @Get("overview")
  getOverview(@Query("days") days?: string) {
    const periodDays = days ? parseInt(days, 10) : 7;
    return this.adminAnalyticsService.getOverview(
      Number.isFinite(periodDays) && periodDays > 0 ? periodDays : 7,
    );
  }
}
