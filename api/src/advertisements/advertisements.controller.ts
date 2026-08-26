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
import { AdvertisementsService } from "./advertisements.service";
import { CreateAdvertisementDto } from "./dto/create-advertisement.dto";
import { UpdateAdvertisementDto } from "./dto/update-advertisement.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Advertisement } from "./entities/advertisement.entity";

// `owner` is `eager: true` on Advertisement (same as Business.owner) —
// every response has to strip it down to the public shape or a raw
// passwordHash leaks straight into the API response. Same pattern as
// BusinessesController's own `sanitize`.
function sanitize(ad: Advertisement) {
  return { ...ad, owner: ad.owner ? toPublicUser(ad.owner) : null };
}

@ApiTags("Advertisements")
@Controller("advertisements")
export class AdvertisementsController {
  constructor(private readonly adsService: AdvertisementsService) {}

  // Public — the "Sponsored" placement feed (Home, Explore, Search).
  @Get("active")
  async findActive(@Query("limit") limit?: string) {
    const ads = await this.adsService.findActive(
      limit ? parseInt(limit, 10) : undefined,
    );
    return ads.map(sanitize);
  }

  // Public — the "See more" detail page a carousel card links to.
  // Declared before the owner-only ":id" route below isn't required for
  // correctness (different segment count — "active/:id" vs ":id" — so
  // there's no route-matching ambiguity either way), but keeps it grouped
  // with the other "active" (approved-only) endpoint above.
  @Get("active/:id")
  async findActiveOne(@Param("id") id: string) {
    return sanitize(await this.adsService.findActiveOne(id));
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateAdvertisementDto) {
    return sanitize(await this.adsService.create(user.id, dto));
  }

  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: User) {
    const ads = await this.adsService.findMine(user.id);
    return ads.map(sanitize);
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findOne(@CurrentUser() user: User, @Param("id") id: string) {
    return sanitize(await this.adsService.findOne(user.id, id));
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateAdvertisementDto,
  ) {
    return sanitize(await this.adsService.update(user.id, id, dto));
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param("id") id: string) {
    await this.adsService.remove(user.id, id);
  }
}
