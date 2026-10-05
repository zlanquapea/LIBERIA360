import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsDateString, Matches } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { AvailabilityAlertsService } from "./availability-alerts.service";
export class WatchGuideDateDto {
  @IsDateString({ strict: true }) @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
}
@Controller()
@UseGuards(JwtAuthGuard)
export class AvailabilityAlertsController {
  constructor(private readonly alerts: AvailabilityAlertsService) {}
  @Get("guides/availability-alerts")
  @Header("Cache-Control", "no-store")
  list(@CurrentUser() user: User) {
    return this.alerts.list(user.id);
  }
  @Post("experiences/:id/availability-alerts")
  subscribe(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: WatchGuideDateDto,
  ) {
    return this.alerts.subscribe(user.id, id, dto.date);
  }
  @Delete("guides/availability-alerts/:id")
  remove(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.alerts.remove(user.id, id);
  }
}
