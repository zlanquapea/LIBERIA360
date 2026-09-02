import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { buildUniqueSlug } from "../common/slugify";
import { User } from "../users/entities/user.entity";
import { ArticleFeedback } from "./entities/article-feedback.entity";
import {
  ArticleStatus,
  KnowledgeArticle,
} from "./entities/knowledge-article.entity";
import { KnowledgeCategory } from "./entities/knowledge-category.entity";
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

// How many other articles from the same category accompany an article —
// enough to be genuinely useful without turning the sidebar into a second
// listing page.
const RELATED_ARTICLES_LIMIT = 4;

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @InjectRepository(KnowledgeCategory)
    private readonly categories: Repository<KnowledgeCategory>,
    @InjectRepository(KnowledgeArticle)
    private readonly articles: Repository<KnowledgeArticle>,
    @InjectRepository(ArticleFeedback)
    private readonly feedback: Repository<ArticleFeedback>,
  ) {}

  // ---- Categories ----------------------------------------------------

  listCategories() {
    return this.categories.find({ order: { sortOrder: "ASC", name: "ASC" } });
  }

  // Public homepage view: every category alongside how many *published*
  // articles it holds, so an empty category (nothing published yet) can
  // be hidden from customers without deleting it outright.
  async listCategoriesWithPublishedCounts() {
    const rows = await this.categories
      .createQueryBuilder("category")
      .loadRelationCountAndMap(
        "category.publishedArticleCount",
        "category.articles",
        "article",
        (qb) =>
          qb.andWhere("article.status = :status", {
            status: ArticleStatus.PUBLISHED,
          }),
      )
      .orderBy("category.sortOrder", "ASC")
      .addOrderBy("category.name", "ASC")
      .getMany();
    return rows as (KnowledgeCategory & { publishedArticleCount: number })[];
  }

  private async getCategory(id: string): Promise<KnowledgeCategory> {
    const category = await this.categories.findOne({ where: { id } });
    if (!category)
      throw new NotFoundException(`Help Center category "${id}" not found`);
    return category;
  }

  async createCategory(dto: CreateKnowledgeCategoryDto) {
    const slug = await buildUniqueSlug(dto.name, (candidate) =>
      this.categories.exists({ where: { slug: candidate } }),
    );
    return this.categories.save(this.categories.create({ ...dto, slug }));
  }

  async updateCategory(id: string, dto: UpdateKnowledgeCategoryDto) {
    const category = await this.getCategory(id);
    if (dto.name && dto.name !== category.name) {
      category.slug = await buildUniqueSlug(dto.name, async (candidate) => {
        const existing = await this.categories.findOne({
          where: { slug: candidate },
        });
        return Boolean(existing && existing.id !== id);
      });
    }
    Object.assign(category, dto);
    return this.categories.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.getCategory(id);
    const articleCount = await this.articles.count({
      where: { categoryId: id },
    });
    if (articleCount > 0)
      throw new BadRequestException(
        "Move or delete this category's articles before deleting it",
      );
    await this.categories.delete(id);
  }

  // ---- Articles --------------------------------------------------------

  private async getArticle(id: string): Promise<KnowledgeArticle> {
    const article = await this.articles.findOne({ where: { id } });
    if (!article) throw new NotFoundException(`Article "${id}" not found`);
    return article;
  }

  async findPublicArticles(query: QueryPublicArticlesDto) {
    const qb = this.articles
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.category", "category")
      .where("article.status = :status", { status: ArticleStatus.PUBLISHED })
      .orderBy("article.updatedAt", "DESC");
    if (query.category)
      qb.andWhere("category.slug = :slug", { slug: query.category });
    if (query.q)
      qb.andWhere(
        new Brackets((sub) =>
          sub
            .where("article.title ILIKE :q")
            .orWhere("article.content ILIKE :q"),
        ),
        { q: `%${query.q}%` },
      );
    const [data, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  async findPublicArticleBySlug(slug: string) {
    const article = await this.articles.findOne({
      where: { slug, status: ArticleStatus.PUBLISHED },
    });
    if (!article) throw new NotFoundException(`Article "${slug}" not found`);
    const related = await this.articles.find({
      where: {
        categoryId: article.categoryId,
        status: ArticleStatus.PUBLISHED,
      },
      order: { updatedAt: "DESC" },
      take: RELATED_ARTICLES_LIMIT + 1,
    });
    return {
      article,
      related: related
        .filter((a) => a.id !== article.id)
        .slice(0, RELATED_ARTICLES_LIMIT),
    };
  }

  async findAllForAdmin(query: QueryAdminArticlesDto) {
    const qb = this.articles
      .createQueryBuilder("article")
      .leftJoinAndSelect("article.category", "category")
      .orderBy("article.updatedAt", "DESC");
    if (query.categoryId)
      qb.andWhere("article.categoryId = :categoryId", {
        categoryId: query.categoryId,
      });
    if (query.status)
      qb.andWhere("article.status = :status", { status: query.status });
    if (query.q) qb.andWhere("article.title ILIKE :q", { q: `%${query.q}%` });
    const [data, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  findOneForAdmin(id: string) {
    return this.getArticle(id);
  }

  async createArticle(author: User, dto: CreateKnowledgeArticleDto) {
    await this.getCategory(dto.categoryId);
    const slug = await buildUniqueSlug(dto.title, (candidate) =>
      this.articles.exists({ where: { slug: candidate } }),
    );
    const article = await this.articles.save(
      this.articles.create({ ...dto, slug, authorUserId: author.id }),
    );
    return this.getArticle(article.id);
  }

  async updateArticle(id: string, dto: UpdateKnowledgeArticleDto) {
    const article = await this.getArticle(id);
    if (dto.categoryId) await this.getCategory(dto.categoryId);
    if (dto.title && dto.title !== article.title) {
      article.slug = await buildUniqueSlug(dto.title, async (candidate) => {
        const existing = await this.articles.findOne({
          where: { slug: candidate },
        });
        return Boolean(existing && existing.id !== id);
      });
    }
    Object.assign(article, dto);
    await this.articles.save(article);
    return this.getArticle(id);
  }

  async deleteArticle(id: string): Promise<void> {
    await this.getArticle(id);
    await this.articles.delete(id);
  }

  // Anonymous, fire-and-forget — see ArticleFeedback's doc comment for why
  // this deliberately doesn't require auth or dedupe server-side.
  async submitFeedback(articleId: string, dto: SubmitArticleFeedbackDto) {
    await this.articles.exists({ where: { id: articleId } }).then((exists) => {
      if (!exists)
        throw new NotFoundException(`Article "${articleId}" not found`);
    });
    await this.feedback.save(
      this.feedback.create({ articleId, helpful: dto.helpful }),
    );
    return { success: true } as const;
  }

  // Small, cheap aggregate shown only on the admin edit screen — never
  // exposed publicly, and never used to gate or moderate anything.
  async feedbackSummary(articleId: string) {
    const [yes, no] = await Promise.all([
      this.feedback.count({ where: { articleId, helpful: true } }),
      this.feedback.count({ where: { articleId, helpful: false } }),
    ]);
    return { yes, no };
  }
}
