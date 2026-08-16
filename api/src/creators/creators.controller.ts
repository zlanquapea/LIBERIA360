import {
  Body,
  Controller,
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
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { toPublicUser } from "../users/user.serializer";
import { Creator } from "./entities/creator.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

function sanitize(creator: Creator) {
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
    const creator = await this.creatorsService.findMine(user.id);
    return creator ? sanitize(creator) : null;
  }

  @Get()
  async findAll(@Query("page") page?: string, @Query("limit") limit?: string) {
    const result = await this.creatorsService.findAll(
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { ...result, data: result.data.map(sanitize) };
  }

  @Get(":username")
  async findByUsername(@Param("username") username: string) {
    return sanitize(await this.creatorsService.findByUsername(username));
  }

  @Patch(":id/featured")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async setFeatured(@Param("id") id: string, @Body() dto: SetFeaturedDto) {
    return sanitize(await this.creatorsService.setFeatured(id, dto));
  }
}
