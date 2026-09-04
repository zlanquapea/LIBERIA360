import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BusinessesService } from "./businesses.service";
import { CreateBusinessDto } from "./dto/create-business.dto";
import { UpdateBusinessDto } from "./dto/update-business.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser, toPublicProfile } from "../users/user.serializer";
import { Business } from "./entities/business.entity";
import { BusinessType } from "./entities/business.enums";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitize(business: Business) {
  return {
    ...business,
    owner: business.owner ? toPublicUser(business.owner) : null,
  };
}

// Security audit (Sep 4, 2026 — CVSS 8.6, same root cause as the
// advertisements finding): `list`/`findBySlug` below have no auth guard
// — this is the public business directory and profile page — but were
// reusing `sanitize` above, which leaks the owner's email,
// isAdmin/isSuperAdmin flags, and 2FA status to any anonymous visitor.
function sanitizePublic(business: Business) {
  return {
    ...business,
    owner: business.owner ? toPublicProfile(business.owner) : null,
  };
}

@ApiTags("Businesses")
@Controller("businesses")
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async claim(@CurrentUser() user: User, @Body() dto: CreateBusinessDto) {
    const business = await this.businessesService.claimPlace(user.id, dto);
    return sanitize(business);
  }

  @Post(":id/claim")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async claimExisting(@CurrentUser() user: User, @Param("id") id: string) {
    const business = await this.businessesService.claimExisting(user.id, id);
    return sanitize(business);
  }

  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser() user: User) {
    const businesses = await this.businessesService.findMine(user.id);
    return businesses.map(sanitize);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateMine(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    const business = await this.businessesService.updateMine(user.id, id, dto);
    return sanitize(business);
  }

  // Public destination-page lookup (`?placeId=`) or the discovery
  // directory (no placeId, optional search/type/county filters +
  // pagination) — both approved-listings-only, see BusinessesService's
  // doc comments.
  @Get()
  async list(
    @Query("placeId") placeId?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("type") type?: BusinessType,
    @Query("countyId") countyId?: string,
  ) {
    if (placeId) {
      const business = await this.businessesService.findByPlace(placeId);
      return business ? sanitizePublic(business) : null;
    }
    const result = await this.businessesService.findAllApproved({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      type,
      countyId,
    });
    return { ...result, data: result.data.map(sanitizePublic) };
  }

  @Get("slug/:slug")
  async findBySlug(@Param("slug") slug: string) {
    const business = await this.businessesService.findBySlug(slug);
    if (!business) {
      throw new NotFoundException(`Business "${slug}" not found`);
    }
    return sanitizePublic(business);
  }
}
