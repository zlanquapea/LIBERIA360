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
import { toPublicUser } from "../users/user.serializer";
import {
  CreateKnowledgeArticleDto,
  QueryAdminArticlesDto,
  QueryPublicArticlesDto,
  SubmitArticleFeedbackDto,
  UpdateKnowledgeArticleDto,
} from "./dto/knowledge-article.dto";
import {
  CreateKnowledgeCategoryDto,
  UpdateKnowledgeCategoryDto,
} from "./dto/knowledge-category.dto";
import { KnowledgeBaseService } from "./knowledge-base.service";

// A KnowledgeArticle's `author` relation is a full User row (password
// hash, 2FA secret, token hashes included) — same leak risk
// SupportController's `sanitize` guards against, so every response that
// might carry an article (single, array, `{data, meta}` page, or the
// `{article, related}` detail shape) goes through this first.
const sanitize = (value: any): any =>
  Array.isArray(value)
    ? value.map(sanitize)
    : value && typeof value === "object"
      ? {
          ...value,
          ...(value.author ? { author: toPublicUser(value.author) } : {}),
          ...(value.data ? { data: sanitize(value.data) } : {}),
          ...(value.article ? { article: sanitize(value.article) } : {}),
          ...(value.related ? { related: sanitize(value.related) } : {}),
        }
      : value;

// Public Help Center — no auth at all, same access model as browsing
// places/events: anyone can read published content, the "Still need help?
// Contact Support" button is what requires being logged in (it's just a
// link to the existing /account/support flow, not a new endpoint).
@ApiTags("Help Center")
@Controller("help-center")
export class KnowledgeBaseController {
  constructor(private readonly kb: KnowledgeBaseService) {}

  @Get("categories") categories() {
    return this.kb.listCategoriesWithPublishedCounts();
  }
  @Get("articles") articles(@Query() query: QueryPublicArticlesDto) {
    return this.kb.findPublicArticles(query).then(sanitize);
  }
  @Get("articles/:slug") article(@Param("slug") slug: string) {
    return this.kb.findPublicArticleBySlug(slug).then(sanitize);
  }
  @Post("articles/:id/feedback") feedback(
    @Param("id") id: string,
    @Body() dto: SubmitArticleFeedbackDto,
  ) {
    return this.kb.submitFeedback(id, dto);
  }
}

@ApiTags("Help Center Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller("admin/help-center")
export class AdminKnowledgeBaseController {
  constructor(private readonly kb: KnowledgeBaseService) {}

  @Get("categories") categories() {
    return this.kb.listCategories();
  }
  @Post("categories") createCategory(@Body() dto: CreateKnowledgeCategoryDto) {
    return this.kb.createCategory(dto);
  }
  @Patch("categories/:id") updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateKnowledgeCategoryDto,
  ) {
    return this.kb.updateCategory(id, dto);
  }
  @Delete("categories/:id") async deleteCategory(
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    await this.kb.deleteCategory(id);
    return { success: true };
  }

  @Get("articles") articles(@Query() query: QueryAdminArticlesDto) {
    return this.kb.findAllForAdmin(query).then(sanitize);
  }
  @Get("articles/:id") article(@Param("id") id: string) {
    return this.kb.findOneForAdmin(id).then(sanitize);
  }
  @Get("articles/:id/feedback-summary") feedbackSummary(
    @Param("id") id: string,
  ) {
    return this.kb.feedbackSummary(id);
  }
  @Post("articles") createArticle(
    @CurrentUser() user: User,
    @Body() dto: CreateKnowledgeArticleDto,
  ) {
    return this.kb.createArticle(user, dto).then(sanitize);
  }
  @Patch("articles/:id") updateArticle(
    @Param("id") id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
  ) {
    return this.kb.updateArticle(id, dto).then(sanitize);
  }
  @Delete("articles/:id") async deleteArticle(
    @Param("id") id: string,
  ): Promise<{ success: true }> {
    await this.kb.deleteArticle(id);
    return { success: true };
  }
}
