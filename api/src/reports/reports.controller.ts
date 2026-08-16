import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { Throttle, seconds } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { CreateContentReportDto } from "./dto/create-content-report.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

@ApiTags("Reports")
@Controller("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @Throttle({ default: { limit: 20, ttl: seconds(60) } })
  report(@CurrentUser() user: User, @Body() dto: CreateContentReportDto) {
    return this.reportsService.report(user.id, dto);
  }
}
