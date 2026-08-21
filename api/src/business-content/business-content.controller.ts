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
import { BusinessContentService } from "./business-content.service";
import { CreateBusinessContentDto } from "./dto/create-business-content.dto";
import { UpdateBusinessContentDto } from "./dto/update-business-content.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

@ApiTags("Business Content")
@Controller("business-content")
export class BusinessContentController {
  constructor(private readonly contentService: BusinessContentService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateBusinessContentDto) {
    return this.contentService.create(user.id, dto);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateBusinessContentDto,
  ) {
    return this.contentService.update(user.id, id, dto);
  }

  @Post(":id/submit")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  submit(@CurrentUser() user: User, @Param("id") id: string) {
    return this.contentService.submit(user.id, id);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param("id") id: string) {
    return this.contentService.remove(user.id, id);
  }

  // The owner's own dashboard — every status, not just approved.
  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: User, @Query("businessId") businessId: string) {
    return this.contentService.findMine(user.id, businessId);
  }

  // Public feed for one business — approved only.
  @Get()
  findPublic(
    @Query("businessId") businessId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.contentService.findPublicForBusiness(businessId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
