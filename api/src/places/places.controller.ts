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
import { PlacesService } from "./places.service";
import { QueryPlacesDto } from "./dto/query-places.dto";
import { CreatePlaceSubmissionDto } from "./dto/create-place-submission.dto";
import { UpdateMyPlaceDto } from "./dto/update-my-place.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("Places")
@Controller("places")
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  findAll(@Query() query: QueryPlacesDto) {
    return this.placesService.findAll(query);
  }

  // Self-service submission — a business owner listing a destination that
  // isn't in the catalog yet. Goes into review, not live immediately; see
  // PlaceReviewStatus's doc comment.
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  submit(@CurrentUser() user: User, @Body() dto: CreatePlaceSubmissionDto) {
    return this.placesService.submitPlace(user.id, dto);
  }

  // A submitter's own places regardless of review status — must come
  // before the :slug route below, or "mine" would be parsed as a slug.
  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: User) {
    return this.placesService.findMine(user.id);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateMine(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateMyPlaceDto,
  ) {
    return this.placesService.updateMine(user.id, id, dto);
  }

  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.placesService.findBySlug(slug);
  }
}
