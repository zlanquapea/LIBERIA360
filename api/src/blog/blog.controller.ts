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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminGuard } from "../auth/guards/admin.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { toPublicUser, toPublicProfile } from "../users/user.serializer";
import { BlogService } from "./blog.service";
import {
  CreateBlogPostDto,
  QueryAdminBlogPostsDto,
  QueryPublicBlogPostsDto,
  UpdateBlogPostDto,
} from "./dto/blog-post.dto";

// A BlogPost's `author` relation is a full User row (password hash, 2FA
// secret, token hashes included) — same leak this app already guards
// against on SupportController/KnowledgeBaseController, so every response
// carrying a post (single, array, or `{data, meta}` page) goes through
// this first.
const sanitize = (value: any): any =>
  Array.isArray(value)
    ? value.map(sanitize)
    : value && typeof value === "object"
      ? {
          ...value,
          ...(value.author ? { author: toPublicUser(value.author) } : {}),
          ...(value.data ? { data: sanitize(value.data) } : {}),
        }
      : value;

// Security audit (Sep 4, 2026 — CVSS 8.6, same root cause as the
// advertisements finding): BlogController below has no auth guard — it's
// the public blog — so `sanitize` above still leaked the post author's
// email, isAdmin/isSuperAdmin flags, and 2FA status (`toPublicUser` was
// never meant for an anonymous reader, see its doc comment). Only
// AdminBlogController — its viewer already cleared the AdminGuard — is
// left on `sanitize`.
const sanitizePublic = (value: any): any =>
  Array.isArray(value)
    ? value.map(sanitizePublic)
    : value && typeof value === "object"
      ? {
          ...value,
          ...(value.author ? { author: toPublicProfile(value.author) } : {}),
          ...(value.data ? { data: sanitizePublic(value.data) } : {}),
        }
      : value;

@ApiTags("Blog")
@Controller("blog")
export class BlogController {
  constructor(private readonly blog: BlogService) {}
  @Get() list(@Query() query: QueryPublicBlogPostsDto) {
    return this.blog.findPublished(query).then(sanitizePublic);
  }
  @Get(":slug") one(@Param("slug") slug: string) {
    return this.blog.findPublishedBySlug(slug).then(sanitizePublic);
  }
}

@ApiTags("Blog Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/blog")
export class AdminBlogController {
  constructor(private readonly blog: BlogService) {}
  @Get() list(@Query() query: QueryAdminBlogPostsDto) {
    return this.blog.findAllForAdmin(query).then(sanitize);
  }
  @Get(":id") one(@Param("id") id: string) {
    return this.blog.findOneForAdmin(id).then(sanitize);
  }
  @Post() create(@CurrentUser() user: User, @Body() dto: CreateBlogPostDto) {
    return this.blog.create(user, dto).then(sanitize);
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdateBlogPostDto,
  ) {
    return this.blog.update(id, dto).then(sanitize);
  }
  @Delete(":id") async delete(
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    await this.blog.delete(id);
    return { success: true };
  }
}
