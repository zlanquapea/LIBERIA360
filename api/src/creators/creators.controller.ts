import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CreatorsService } from "./creators.service";
import { CreateCreatorDto } from "./dto/create-creator.dto";
import { UpdateCreatorDto } from "./dto/update-creator.dto";
import { SetFeaturedDto } from "./dto/set-featured.dto";
import { CreatePortfolioItemDto } from "./dto/create-portfolio-item.dto";
import { UpdatePortfolioItemDto } from "./dto/update-portfolio-item.dto";
import { CreateOfferingDto } from "./dto/create-offering.dto";
import { UpdateOfferingDto } from "./dto/update-offering.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Creator } from "./entities/creator.entity";
import { CreatorCategory } from "./entities/creator.enums";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitize<T extends Creator>(creator: T) {
  return { ...creator, user: creator.user ? toPublicUser(creator.user) : null };
}

@ApiTags("Creators")
@Controller("creators")
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: User, @Body() dto: CreateCreatorDto) {
    return sanitize(await this.creatorsService.create(user.id, dto));
  }

  @Patch("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async updateMine(@CurrentUser() user: User, @Body() dto: UpdateCreatorDto) {
    return sanitize(await this.creatorsService.update(user.id, dto));
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: User) {
    const creator = await this.creatorsService.findMineWithRelated(user.id);
    return creator ? sanitize(creator) : null;
  }

  @Post("me/portfolio")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addPortfolioItem(
    @CurrentUser() user: User,
    @Body() dto: CreatePortfolioItemDto,
  ) {
    return this.creatorsService.addPortfolioItem(user.id, dto);
  }

  @Patch("me/portfolio/:itemId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updatePortfolioItem(
    @CurrentUser() user: User,
    @Param("itemId") itemId: string,
    @Body() dto: UpdatePortfolioItemDto,
  ) {
    return this.creatorsService.updatePortfolioItem(user.id, itemId, dto);
  }

  @Delete("me/portfolio/:itemId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removePortfolioItem(
    @CurrentUser() user: User,
    @Param("itemId") itemId: string,
  ) {
    return this.creatorsService.removePortfolioItem(user.id, itemId);
  }

  @Post("me/offerings")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addOffering(@CurrentUser() user: User, @Body() dto: CreateOfferingDto) {
    return this.creatorsService.addOffering(user.id, dto);
  }

  @Patch("me/offerings/:offeringId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateOffering(
    @CurrentUser() user: User,
    @Param("offeringId") offeringId: string,
    @Body() dto: UpdateOfferingDto,
  ) {
    return this.creatorsService.updateOffering(user.id, offeringId, dto);
  }

  @Delete("me/offerings/:offeringId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  removeOffering(
    @CurrentUser() user: User,
    @Param("offeringId") offeringId: string,
  ) {
    return this.creatorsService.removeOffering(user.id, offeringId);
  }

  @Get()
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("search") search?: string,
    @Query("category") category?: CreatorCategory,
    @Query("countyId") countyId?: string,
    @Query("featuredOnly") featuredOnly?: string,
  ) {
    const result = await this.creatorsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      category,
      countyId,
      featuredOnly: featuredOnly === "true",
    });
    return { ...result, data: result.data.map(sanitize) };
  }

  @Get(":id/follow")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getFollowState(@CurrentUser() user: User, @Param("id") creatorId: string) {
    return this.creatorsService.getFollowState(user.id, creatorId);
  }

  @Post(":id/follow")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  toggleFollow(@CurrentUser() user: User, @Param("id") creatorId: string) {
    return this.creatorsService.toggleFollow(user.id, creatorId);
  }

  @Get(":username")
  async findByUsername(@Param("username") username: string) {
    return sanitize(
      await this.creatorsService.findByUsernameWithRelated(username),
    );
  }

  @Patch(":id/featured")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async setFeatured(@Param("id") id: string, @Body() dto: SetFeaturedDto) {
    return sanitize(await this.creatorsService.setFeatured(id, dto));
  }
}
