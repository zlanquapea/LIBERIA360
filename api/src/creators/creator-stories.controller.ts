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

  @Get()
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
