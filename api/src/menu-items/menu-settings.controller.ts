import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MenuItemsService } from "./menu-items.service";
import { UpdateMenuSettingsDto } from "./dto/update-menu-settings.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

@ApiTags("Menu Items")
@Controller("menu-settings")
export class MenuSettingsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @Get(":businessId")
  get(@Param("businessId", ParseUUIDPipe) businessId: string) {
    return this.menuItemsService.getSettings(businessId);
  }

  @Patch(":businessId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: User,
    @Param("businessId", ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateMenuSettingsDto,
  ) {
    return this.menuItemsService.updateSettings(user.id, businessId, dto);
  }
}
