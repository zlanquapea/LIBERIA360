import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { User } from "../users/entities/user.entity";
import { TravelerInfoService } from "./traveler-info.service";
import { UpdateTravelerInfoDto } from "./dto/update-traveler-info.dto";
import { TravelerInfoSettings } from "./entities/traveler-info-settings.entity";

@ApiTags("Traveler Info")
@Controller("traveler-info")
export class TravelerInfoController {
  constructor(private readonly travelerInfoService: TravelerInfoService) {}

  @Get()
  get(): Promise<TravelerInfoSettings> {
    return this.travelerInfoService.get();
  }

  // Plain admin, deliberately not super-admin — this is public content,
  // not security/moderation config (see TravelerInfoSettings' doc
  // comment).
  @Patch()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @CurrentUser() user: User,
    @Body() dto: UpdateTravelerInfoDto,
  ): Promise<TravelerInfoSettings> {
    return this.travelerInfoService.update(dto, user.id);
  }
}
