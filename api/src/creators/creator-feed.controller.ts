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
import { Throttle, seconds } from "@nestjs/throttler";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { CreateCreatorPostCommentDto } from "./dto/create-creator-post-comment.dto";
import { CreateCreatorPostDto } from "./dto/create-creator-post.dto";
import { UpdateCreatorPostDto } from "./dto/update-creator-post.dto";
import { CreatorFeedService } from "./creator-feed.service";

@ApiTags("Creator Feed")
@Controller("creators")
export class CreatorFeedController {
  constructor(private readonly feedService: CreatorFeedService) {}

  @Get("feed")
  findPublicFeed(@Query("page") page?: string, @Query("limit") limit?: string) {
    return this.feedService.findPublicFeed({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("feed/following")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findFollowedFeed(
    @CurrentUser() user: User,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.feedService.findFollowedFeed(user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("feed/creator/:username")
  findCreatorFeed(
    @Param("username") username: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.feedService.findPublicFeedForCreator(username, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("feed/me")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findMyFeed(@CurrentUser() user: User) {
    return this.feedService.findMine(user.id);
  }

  @Post("me/posts")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: User, @Body() dto: CreateCreatorPostDto) {
    return this.feedService.create(user.id, dto);
  }

  @Patch("me/posts/:postId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: User,
    @Param("postId") postId: string,
    @Body() dto: UpdateCreatorPostDto,
  ) {
    return this.feedService.update(user.id, postId, dto);
  }

  @Delete("me/posts/:postId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: User, @Param("postId") postId: string) {
    return this.feedService.remove(user.id, postId);
  }

  @Post("posts/:postId/like")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  toggleLike(@CurrentUser() user: User, @Param("postId") postId: string) {
    return this.feedService.toggleLike(user.id, postId);
  }

  @Post("posts/:postId/save")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  toggleSave(@CurrentUser() user: User, @Param("postId") postId: string) {
    return this.feedService.toggleSave(user.id, postId);
  }

  @Post("posts/:postId/share")
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  recordShare(@Param("postId") postId: string) {
    return this.feedService.recordShare(postId);
  }

  @Get("posts/:postId/comments")
  findComments(@Param("postId") postId: string) {
    return this.feedService.findComments(postId);
  }

  @Post("posts/:postId/comments")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  addComment(
    @CurrentUser() user: User,
    @Param("postId") postId: string,
    @Body() dto: CreateCreatorPostCommentDto,
  ) {
    return this.feedService.addComment(user.id, postId, dto);
  }

  @Delete("posts/:postId/comments/:commentId")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeComment(
    @CurrentUser() user: User,
    @Param("postId") postId: string,
    @Param("commentId") commentId: string,
  ) {
    return this.feedService.removeComment(user.id, postId, commentId);
  }
}
