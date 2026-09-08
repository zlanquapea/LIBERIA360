import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import {
  CreateCreatorStoryDto,
  ReportCreatorStoryDto,
} from "./dto/create-creator-story.dto";
import { CreatorStoriesService } from "./creator-stories.service";

@ApiTags("Creator Stories")
@Controller("creators/stories")
export class CreatorStoriesController {
  constructor(private readonly stories: CreatorStoriesService) {}

  // Public — no login required to browse — but decorated with
  // OptionalJwtAuthGuard (not left bare) so a signed-in viewer's
  // followers-only stories and per-story viewedByMe flag actually come
  // back correct instead of every viewer silently reading as
  // signed-out. See that guard's doc comment, and
  // CreatorFeedController.findPublicFeed's identical fix, for why a bare
  // `@CurrentUser() user?: User` here never populates `user` at all (bug
  // fix, Sep 2026: this is why a follower-only story 404'd even for its
  // own followers, and why the story tray's "seen" ring never updated).
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  listActive(@CurrentUser() user?: User) {
    return this.stories.listActive(user?.id);
  }

  @Get("eligibility")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  eligibility(@CurrentUser() user: User) {
    return this.stories.eligibility(user.id);
  }

  @Get("me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: User) {
    return this.stories.listMine(user.id);
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  get(@Param("id") id: string, @CurrentUser() user?: User) {
    return this.stories.getStory(id, user?.id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateCreatorStoryDto) {
    return this.stories.create(user.id, dto);
  }

  @Post(":id/view")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  view(@CurrentUser() user: User, @Param("id") id: string) {
    return this.stories.recordView(id, user.id);
  }

  @Post(":id/report")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  report(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: ReportCreatorStoryDto,
  ) {
    return this.stories.report(user.id, id, dto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: User, @Param("id") id: string) {
    return this.stories.remove(user.id, id);
  }
}
