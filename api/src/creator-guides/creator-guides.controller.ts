import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { CreatorGuidesService } from "./creator-guides.service";
import {
  CreateCreatorGuideDto,
  QueryCreatorGuidesDto,
  ReviewCreatorGuideDto,
  UpdateCreatorGuideDto,
} from "./dto/upsert-creator-guide.dto";

@ApiTags("creator-guides")
@Controller("creator-guides")
export class CreatorGuidesController {
  constructor(private readonly guides: CreatorGuidesService) {}

  /** Published guides, newest first; filter by a place or a creator. */
  @Get()
  list(@Query() query: QueryCreatorGuidesDto) {
    return this.guides.listPublished(query);
  }

  // Literal routes before ":slug" so they aren't read as a slug.
  @Get("mine")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: User) {
    return this.guides.listMine(user.id);
  }

  @Get("mine/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findMine(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.guides.findMine(user.id, id);
  }

  @Get("saved")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listSaved(@CurrentUser() user: User) {
    return this.guides.listSaved(user.id);
  }

  @Get("saved-ids")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  savedIds(@CurrentUser() user: User) {
    return this.guides.savedIds(user.id);
  }

  @Get(":slug")
  findOne(@Param("slug") slug: string) {
    return this.guides.findPublished(slug);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateCreatorGuideDto) {
    return this.guides.create(user.id, dto);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCreatorGuideDto,
  ) {
    return this.guides.update(user.id, id, dto);
  }

  @Post(":id/submit")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  submit(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.guides.submit(user.id, id);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.guides.remove(user.id, id);
  }

  @Post(":id/save")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  save(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.guides.save(user.id, id);
  }

  @Delete(":id/save")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  unsave(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.guides.unsave(user.id, id);
  }

  /** Copies a published guide into a new private trip for the caller. */
  @Post(":id/use-as-trip")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  useAsTrip(@CurrentUser() user: User, @Param("id", ParseUUIDPipe) id: string) {
    return this.guides.useAsTrip(user.id, id);
  }
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/creator-guides")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCreatorGuidesController {
  constructor(private readonly guides: CreatorGuidesService) {}

  @Get("pending")
  listPending() {
    return this.guides.listPending();
  }

  @Post(":id/review")
  review(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewCreatorGuideDto,
  ) {
    return this.guides.review(user.id, id, dto);
  }
}
