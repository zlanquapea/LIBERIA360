import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Header,
  ParseUUIDPipe,
} from "@nestjs/common";
import { IsBoolean, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { TripActivityService } from "./trip-activity.service";
class ActivityQuery {
  @Type(() => Number) @IsInt() @Min(0) @Max(10000) page = 0;
}
class MuteActivityDto {
  @IsBoolean() muted: boolean;
}
@Controller("itineraries/:id/activity")
@UseGuards(JwtAuthGuard)
export class TripActivityController {
  constructor(private readonly activity: TripActivityService) {}
  @Get() @Header("Cache-Control", "no-store") list(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: ActivityQuery,
  ) {
    return this.activity.list(user.id, id, query.page);
  }
  @Put("preferences") mute(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: MuteActivityDto,
  ) {
    return this.activity.mute(user.id, id, body.muted);
  }
}
