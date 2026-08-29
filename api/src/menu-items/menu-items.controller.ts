import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { MenuItemsService } from "./menu-items.service";
import { CreateMenuItemDto } from "./dto/create-menu-item.dto";
import { UpdateMenuItemDto } from "./dto/update-menu-item.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

@ApiTags("Menu Items")
@Controller("menu-items")
export class MenuItemsController {
  constructor(private readonly menuItemsService: MenuItemsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateMenuItemDto) {
    return this.menuItemsService.create(user.id, dto);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuItemsService.update(user.id, id, dto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param("id") id: string) {
    return this.menuItemsService.remove(user.id, id);
  }

  // Public menu for one business — also what the owner's own manage UI
  // reads, since there's no draft/review distinction (see
  // MenuItemsService.findForBusiness's doc comment).
  @Get()
  findForBusiness(@Query("businessId") businessId: string) {
    return this.menuItemsService.findForBusiness(businessId);
  }
}
