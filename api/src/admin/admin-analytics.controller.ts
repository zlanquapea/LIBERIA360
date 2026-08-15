import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminAnalyticsService } from "./admin-analytics.service";
import { QueryAggregateAnalyticsDto } from "./dto/query-aggregate-analytics.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";

@Controller("admin/analytics")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get("aggregate")
  getAggregate(@Query() query: QueryAggregateAnalyticsDto) {
    return this.adminAnalyticsService.getAggregate(query.limit);
  }
}
