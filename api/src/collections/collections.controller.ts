import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { SaveCollectionDto } from "./collection.dto";
import { CollectionsService } from "./collections.service";
@Controller("collections")
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}
  @Get("shared/:token")
  @Header("Cache-Control", "no-store")
  shared(@Param("token", ParseUUIDPipe) token: string) {
    return this.service.shared(token);
  }
  @Get()
  @UseGuards(JwtAuthGuard)
  @Header("Cache-Control", "no-store")
  list(@CurrentUser() user: User) {
    return this.service.list(user.id);
  }
  @Put(":id")
  @UseGuards(JwtAuthGuard)
  save(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveCollectionDto,
  ) {
    return this.service.save(user.id, id, dto);
  }
  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(user.id, id);
  }
}
