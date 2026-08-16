import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { FreshnessService } from "./freshness.service";
import { CreateFreshnessReportDto } from "./dto/create-freshness-report.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

@Controller("freshness-reports")
@UseGuards(JwtAuthGuard)
export class FreshnessController {
  constructor(private readonly freshnessService: FreshnessService) {}

  @Post()
  report(@CurrentUser() user: User, @Body() dto: CreateFreshnessReportDto) {
    return this.freshnessService.report(user.id, dto);
  }

  @Get("mine")
  findMine(@CurrentUser() user: User, @Query("placeId") placeId: string) {
    if (!placeId) {
      return null;
    }
    return this.freshnessService.findMine(user.id, placeId);
  }
}
