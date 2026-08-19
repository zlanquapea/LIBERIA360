import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { SponsoredPlacementsService } from "./sponsored-placements.service";
import { CreateSponsoredPlacementDto } from "./dto/create-sponsored-placement.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { SponsoredPlacement } from "./entities/sponsored-placement.entity";
import { getRequestInfo } from "../common/request-info";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitize(placement: SponsoredPlacement) {
  return {
    ...placement,
    createdBy: placement.createdBy ? toPublicUser(placement.createdBy) : null,
  };
}

@ApiTags("Sponsored Placements")
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
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll() {
    const placements = await this.sponsoredPlacementsService.findAll();
    return placements.map(sanitize);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateSponsoredPlacementDto,
    @Req() req: Request,
  ) {
    return sanitize(
      await this.sponsoredPlacementsService.create(
        user.id,
        dto,
        getRequestInfo(req),
      ),
    );
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    await this.sponsoredPlacementsService.revoke(
      user.id,
      id,
      getRequestInfo(req),
    );
  }
}
