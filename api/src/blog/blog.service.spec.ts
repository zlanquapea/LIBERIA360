import { NotFoundException } from "@nestjs/common";
import { BlogService } from "./blog.service";
import { BlogPostStatus } from "./entities/blog-post.entity";

const author = { id: "author-1" } as any;

function setup(rows: any[] = []) {
  const store = [...rows];
  const qbResult = { data: [] as any[], total: 0 };
  const posts = {
    exists: jest.fn(async ({ where: { slug } }: any) =>
      store.some((r) => r.slug === slug),
    ),
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id) return store.find((r) => r.id === where.id) ?? null;
      if (where.slug) {
        return (
          store.find(
            (r) =>
              r.slug === where.slug &&
              (where.status === undefined || r.status === where.status),
          ) ?? null
        );
      }
      return null;
    }),
    // Real TypeORM's repository.create() fills in column defaults
    // (status: 'draft' here) for anything the caller didn't set — mirror
    // that so this mock behaves the same as the real repository would.
    create: jest.fn((value: any) => ({
      status: BlogPostStatus.DRAFT,
      ...value,
    })),
    save: jest.fn(async (value: any) => {
      if (!value.id) value.id = `post-${store.length + 1}`;
      const idx = store.findIndex((r) => r.id === value.id);
      if (idx >= 0) store[idx] = { ...store[idx], ...value };
      else store.push(value);
      return store.find((r) => r.id === value.id);
    }),
    delete: jest.fn(async (id: string) => {
      const idx = store.findIndex((r) => r.id === id);
      if (idx >= 0) store.splice(idx, 1);
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: any = {
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
  return { posts, store, qbResult, service: new BlogService(posts) };
}

describe("BlogService", () => {
  it("sets publishedAt when a post is created already published", async () => {
    const { service } = setup();
    const post = await service.create(author, {
      title: "Launch week",
      content: "We are live!",
      status: BlogPostStatus.PUBLISHED,
    } as any);
    expect(post.status).toBe(BlogPostStatus.PUBLISHED);
    expect(post.publishedAt).toBeInstanceOf(Date);
    expect(post.authorUserId).toBe(author.id);
  });

  it("leaves publishedAt null for a draft", async () => {
    const { service } = setup();
    const post = await service.create(author, {
      title: "Work in progress",
      content: "Not ready yet",
    } as any);
    expect(post.status).toBe(BlogPostStatus.DRAFT);
    expect(post.publishedAt).toBeNull();
  });

  it("sets publishedAt the first time a draft moves to published", async () => {
    const { service, store } = setup([
      {
        id: "post-1",
        title: "Old title",
        slug: "old-title",
        status: BlogPostStatus.DRAFT,
        publishedAt: null,
      },
    ]);
    const updated = await service.update("post-1", {
      status: BlogPostStatus.PUBLISHED,
    });
    expect(updated.publishedAt).toBeInstanceOf(Date);
    expect(store[0].publishedAt).toBeInstanceOf(Date);
  });

  it("does not reset publishedAt on a second, unrelated update", async () => {
    const firstPublish = new Date("2024-01-01T00:00:00Z");
    const { service } = setup([
      {
        id: "post-1",
        title: "Old title",
        slug: "old-title",
        status: BlogPostStatus.PUBLISHED,
        publishedAt: firstPublish,
      },
    ]);
    const updated = await service.update("post-1", { content: "Updated body" });
    expect(updated.publishedAt).toEqual(firstPublish);
  });

  it("regenerates the slug on a title rename, deduping against existing slugs", async () => {
    const { service } = setup([
      {
        id: "post-1",
        title: "My Post",
        slug: "my-post",
        status: BlogPostStatus.DRAFT,
      },
      {
        id: "post-2",
        title: "My Post V2",
        slug: "my-post-v2",
        status: BlogPostStatus.DRAFT,
      },
    ]);
    const updated = await service.update("post-1", { title: "My Post V2" });
    // Renaming post-1 to collide with post-2's slug should dedupe, not steal it.
    expect(updated.slug).not.toBe("my-post-v2");
    expect(updated.slug).toMatch(/^my-post-v2-\d+$/);
  });

  it("throws deleting a post that does not exist", async () => {
    const { service } = setup();
    await expect(service.delete("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("only resolves published posts by slug for the public detail view", async () => {
    const { service } = setup([
      { id: "post-1", slug: "draft-post", status: BlogPostStatus.DRAFT },
    ]);
    await expect(
      service.findPublishedBySlug("draft-post"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
