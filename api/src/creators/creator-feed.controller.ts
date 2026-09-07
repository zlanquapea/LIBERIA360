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
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { CreateCreatorPostCommentDto } from "./dto/create-creator-post-comment.dto";
import { CreateCreatorPostDto } from "./dto/create-creator-post.dto";
import { UpdateCreatorPostDto } from "./dto/update-creator-post.dto";
import { CreatorFeedService } from "./creator-feed.service";

@ApiTags("Creator Feed")
@Controller("creators")
export class CreatorFeedController {
  constructor(private readonly feedService: CreatorFeedService) {}

  // Public — no login required to browse — but decorated with
  // OptionalJwtAuthGuard (not left bare) so a signed-in caller's
  // per-post viewerLiked/viewerSaved still comes back correct instead
  // of every post silently reading as not-liked/not-saved on every
  // reload. See that guard's doc comment for why a bare @CurrentUser()
  // here would never populate `user` at all (bug fix, Sep 6, 2026: this
  // is why "Save" on a creator post looked like it wasn't working —
  // it *was* saving, but the button reset to its unsaved look on every
  // feed reload, and the next click undid the save it can't see it already made).
  @Get("feed")
  @UseGuards(OptionalJwtAuthGuard)
  findPublicFeed(
    @CurrentUser() user: User | undefined,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.feedService.findPublicFeed({
      userId: user?.id,
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
  @UseGuards(OptionalJwtAuthGuard)
  findCreatorFeed(
    @CurrentUser() user: User | undefined,
    @Param("username") username: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.feedService.findPublicFeedForCreator(username, {
      userId: user?.id,
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

  @Get("saved/posts")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findSavedPosts(@CurrentUser() user: User) {
    return this.feedService.findSaved(user.id);
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

  // Same OptionalJwtAuthGuard fix as findPublicFeed above — this was
  // already written assuming `user` could come back undefined (guest)
  // or populated (signed in), but with no guard at all @CurrentUser()
  // never actually ran the "jwt" strategy, so it was always undefined
  // regardless: a signed-in caller's own comment likes never reflected
  // as liked on load either.
  @Get("posts/:postId/comments")
  @UseGuards(OptionalJwtAuthGuard)
  findComments(
    @Param("postId") postId: string,
    @CurrentUser() user: User | undefined,
  ) {
    return this.feedService.findComments(postId, user?.id);
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

  @Post("posts/:postId/comments/:commentId/like")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  toggleCommentLike(
    @CurrentUser() user: User,
    @Param("postId") postId: string,
    @Param("commentId") commentId: string,
  ) {
    return this.feedService.toggleCommentLike(user.id, postId, commentId);
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
