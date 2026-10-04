import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  HttpCode,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsOptional, IsUUID } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { GuideInsightsService } from "./guide-insights.service";
export class GuideViewDto {
  @IsUUID() id: string;
  @IsOptional() @IsUUID() guideId?: string;
  @IsOptional() @IsUUID() experienceId?: string;
}
@Controller("guide-insights")
export class GuideInsightsController {
  constructor(private readonly insights: GuideInsightsService) {}
  @Post("views") @HttpCode(204) record(@Body() d: GuideViewDto) {
    return this.insights.record(d.id, d.guideId, d.experienceId);
  }
  @Get("me")
  @Header("Cache-Control", "no-store")
  @UseGuards(JwtAuthGuard)
  mine(
    @CurrentUser() u: User,
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    return this.insights.mine(u.id, days);
  }
}
