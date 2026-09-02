import { BadRequestException, NotFoundException } from "@nestjs/common";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { ArticleStatus } from "./entities/knowledge-article.entity";

const author = { id: "author-1" } as any;

function setup(
  opts: { categories?: any[]; articles?: any[]; feedback?: any[] } = {},
) {
  const categoryStore = [...(opts.categories ?? [])];
  const articleStore = [...(opts.articles ?? [])];
  const feedbackStore = [...(opts.feedback ?? [])];

  const categories = {
    find: jest.fn(async () => [...categoryStore]),
    findOne: jest.fn(
      async ({ where: { id, slug } }: any) =>
        categoryStore.find((c) => (id ? c.id === id : c.slug === slug)) ?? null,
    ),
    exists: jest.fn(async ({ where: { slug } }: any) =>
      categoryStore.some((c) => c.slug === slug),
    ),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => {
      if (!value.id) value.id = `cat-${categoryStore.length + 1}`;
      const idx = categoryStore.findIndex((c) => c.id === value.id);
      if (idx >= 0) categoryStore[idx] = { ...categoryStore[idx], ...value };
      else categoryStore.push(value);
      return categoryStore.find((c) => c.id === value.id);
    }),
    delete: jest.fn(async (id: string) => {
      const idx = categoryStore.findIndex((c) => c.id === id);
      if (idx >= 0) categoryStore.splice(idx, 1);
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        loadRelationCountAndMap: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        addOrderBy: jest.fn(() => qb),
        getMany: jest.fn(async () =>
          categoryStore.map((c) => ({ ...c, publishedArticleCount: 0 })),
        ),
      };
      return qb;
    }),
  } as any;

  const qbResult = { data: [] as any[], total: 0 };
  const articles = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id) return articleStore.find((a) => a.id === where.id) ?? null;
      if (where.slug) {
        return (
          articleStore.find(
            (a) =>
              a.slug === where.slug &&
              (where.status === undefined || a.status === where.status),
          ) ?? null
        );
      }
      return null;
    }),
    find: jest.fn(async ({ where }: any) =>
      articleStore.filter(
        (a) =>
          a.categoryId === where.categoryId &&
          (where.status === undefined || a.status === where.status),
      ),
    ),
    count: jest.fn(
      async ({ where }: any) =>
        articleStore.filter(
          (a) => !where.categoryId || a.categoryId === where.categoryId,
        ).length,
    ),
    exists: jest.fn(async ({ where }: any) =>
      where.id
        ? articleStore.some((a) => a.id === where.id)
        : articleStore.some((a) => a.slug === where.slug),
    ),
    create: jest.fn((value: any) => ({
      status: ArticleStatus.DRAFT,
      ...value,
    })),
    save: jest.fn(async (value: any) => {
      if (!value.id) value.id = `article-${articleStore.length + 1}`;
      const idx = articleStore.findIndex((a) => a.id === value.id);
      if (idx >= 0) articleStore[idx] = { ...articleStore[idx], ...value };
      else articleStore.push(value);
      return articleStore.find((a) => a.id === value.id);
    }),
    delete: jest.fn(async (id: string) => {
      const idx = articleStore.findIndex((a) => a.id === id);
      if (idx >= 0) articleStore.splice(idx, 1);
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
        leftJoinAndSelect: jest.fn(() => qb),
        where: jest.fn(() => qb),
        andWhere: jest.fn(() => qb),
        orderBy: jest.fn(() => qb),
        skip: jest.fn(() => qb),
        take: jest.fn(() => qb),
        getManyAndCount: jest.fn(async () => [qbResult.data, qbResult.total]),
      };
      return qb;
    }),
  } as any;

  const feedback = {
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => {
      feedbackStore.push(value);
      return value;
    }),
    count: jest.fn(
      async ({ where }: any) =>
        feedbackStore.filter(
          (f) => f.articleId === where.articleId && f.helpful === where.helpful,
        ).length,
    ),
  } as any;

  return {
    categoryStore,
    articleStore,
    feedbackStore,
    categories,
    articles,
    feedback,
    service: new KnowledgeBaseService(categories, articles, feedback),
  };
}

describe("KnowledgeBaseService", () => {
  describe("categories", () => {
    it("slugifies a new category's name", async () => {
      const { service } = setup();
      const category = await service.createCategory({
        name: "Bookings & Payments",
      });
      expect(category.slug).toBe("bookings-payments");
    });

    it("dedupes a slug collision with an existing category", async () => {
      const { service } = setup({
        categories: [{ id: "cat-1", name: "Payments", slug: "payments" }],
      });
      const category = await service.createCategory({ name: "Payments" });
      expect(category.slug).toBe("payments-2");
    });

    it("refuses to delete a category that still has articles", async () => {
      const { service } = setup({
        categories: [{ id: "cat-1", name: "Bookings", slug: "bookings" }],
        articles: [
          { id: "a1", categoryId: "cat-1", status: ArticleStatus.PUBLISHED },
        ],
      });
      await expect(service.deleteCategory("cat-1")).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("allows deleting an empty category", async () => {
      const { service, categoryStore } = setup({
        categories: [{ id: "cat-1", name: "Empty", slug: "empty" }],
      });
      await service.deleteCategory("cat-1");
      expect(categoryStore).toHaveLength(0);
    });
  });

  describe("articles", () => {
    it("assigns the creating admin as author and slugifies the title", async () => {
      const { service } = setup({
        categories: [{ id: "cat-1", name: "Bookings", slug: "bookings" }],
      });
      const article = await service.createArticle(author, {
        categoryId: "cat-1",
        title: "How do I cancel?",
        content: "Go to My Bookings and tap Cancel.",
      });
      expect(article.authorUserId).toBe(author.id);
      expect(article.slug).toBe("how-do-i-cancel");
      expect(article.status).toBe(ArticleStatus.DRAFT);
    });

    it("rejects creating an article under a category that does not exist", async () => {
      const { service } = setup();
      await expect(
        service.createArticle(author, {
          categoryId: "missing",
          title: "Title",
          content: "Body text here.",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("regenerates the slug on rename, deduping against another article", async () => {
      const { service } = setup({
        categories: [{ id: "cat-1", name: "Bookings", slug: "bookings" }],
        articles: [
          {
            id: "a1",
            categoryId: "cat-1",
            title: "Old",
            slug: "old",
            status: ArticleStatus.DRAFT,
          },
          {
            id: "a2",
            categoryId: "cat-1",
            title: "New",
            slug: "new",
            status: ArticleStatus.DRAFT,
          },
        ],
      });
      const updated = await service.updateArticle("a1", { title: "New" });
      expect(updated.slug).toBe("new-2");
    });

    it("only returns related articles from the same category, excluding itself", async () => {
      const { service } = setup({
        categories: [{ id: "cat-1", name: "Bookings", slug: "bookings" }],
        articles: [
          {
            id: "a1",
            categoryId: "cat-1",
            slug: "primary",
            status: ArticleStatus.PUBLISHED,
            updatedAt: new Date(),
          },
          {
            id: "a2",
            categoryId: "cat-1",
            slug: "sibling",
            status: ArticleStatus.PUBLISHED,
            updatedAt: new Date(),
          },
          {
            id: "a3",
            categoryId: "other-cat",
            slug: "unrelated",
            status: ArticleStatus.PUBLISHED,
            updatedAt: new Date(),
          },
        ],
      });
      const { article, related } =
        await service.findPublicArticleBySlug("primary");
      expect(article.id).toBe("a1");
      expect(related.map((a) => a.id)).toEqual(["a2"]);
    });

    it("404s on a draft article requested by slug from the public endpoint", async () => {
      const { service } = setup({
        articles: [
          {
            id: "a1",
            categoryId: "cat-1",
            slug: "draft",
            status: ArticleStatus.DRAFT,
          },
        ],
      });
      await expect(
        service.findPublicArticleBySlug("draft"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("feedback", () => {
    it("records anonymous helpful/not-helpful votes and summarizes them", async () => {
      const { service } = setup({
        articles: [
          {
            id: "a1",
            categoryId: "cat-1",
            slug: "x",
            status: ArticleStatus.PUBLISHED,
          },
        ],
      });
      await service.submitFeedback("a1", { helpful: true });
      await service.submitFeedback("a1", { helpful: true });
      await service.submitFeedback("a1", { helpful: false });
      const summary = await service.feedbackSummary("a1");
      expect(summary).toEqual({ yes: 2, no: 1 });
    });

    it("404s feedback submitted against an article that does not exist", async () => {
      const { service, articles } = setup();
      articles.exists = jest.fn(async () => false);
      await expect(
        service.submitFeedback("missing", { helpful: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
