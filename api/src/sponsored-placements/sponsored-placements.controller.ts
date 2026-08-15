import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SponsoredPlacementsService } from "./sponsored-placements.service";
import { CreateSponsoredPlacementDto } from "./dto/create-sponsored-placement.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { SponsoredPlacement } from "./entities/sponsored-placement.entity";

function sanitize(placement: SponsoredPlacement) {
  return {
    ...placement,
    createdBy: placement.createdBy ? toPublicUser(placement.createdBy) : null,
  };
}

@Controller("sponsored-placements")
export class SponsoredPlacementsController {
  constructor(
    private readonly sponsoredPlacementsService: SponsoredPlacementsService,
  ) {}

  @Get("active")
  async findActive() {
    const placements = await this.sponsoredPlacementsService.findActive();
    return placements.map(sanitize);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll() {
    const placements = await this.sponsoredPlacementsService.findAll();
    return placements.map(sanitize);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateSponsoredPlacementDto,
  ) {
    return sanitize(await this.sponsoredPlacementsService.create(user.id, dto));
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param("id") id: string) {
    await this.sponsoredPlacementsService.revoke(id);
  }
}
