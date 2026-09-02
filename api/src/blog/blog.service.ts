import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { buildUniqueSlug } from "../common/slugify";
import { User } from "../users/entities/user.entity";
import {
  CreateBlogPostDto,
  QueryAdminBlogPostsDto,
  QueryPublicBlogPostsDto,
  UpdateBlogPostDto,
} from "./dto/blog-post.dto";
import { BlogPost, BlogPostStatus } from "./entities/blog-post.entity";

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPost) private readonly posts: Repository<BlogPost>,
  ) {}

  async findPublished(query: QueryPublicBlogPostsDto) {
    const qb = this.posts
      .createQueryBuilder("post")
      .where("post.status = :status", { status: BlogPostStatus.PUBLISHED })
      .orderBy("post.publishedAt", "DESC");
    if (query.q)
      qb.andWhere(
        new Brackets((sub) =>
          sub.where("post.title ILIKE :q").orWhere("post.content ILIKE :q"),
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

  async findPublishedBySlug(slug: string) {
    const post = await this.posts.findOne({
      where: { slug, status: BlogPostStatus.PUBLISHED },
    });
    if (!post) throw new NotFoundException(`Post "${slug}" not found`);
    return post;
  }

  async findAllForAdmin(query: QueryAdminBlogPostsDto) {
    const qb = this.posts
      .createQueryBuilder("post")
      .orderBy("post.updatedAt", "DESC");
    if (query.status)
      qb.andWhere("post.status = :status", { status: query.status });
    if (query.q) qb.andWhere("post.title ILIKE :q", { q: `%${query.q}%` });
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

  private async get(id: string): Promise<BlogPost> {
    const post = await this.posts.findOne({ where: { id } });
    if (!post) throw new NotFoundException(`Post "${id}" not found`);
    return post;
  }

  findOneForAdmin(id: string) {
    return this.get(id);
  }

  async create(author: User, dto: CreateBlogPostDto) {
    const slug = await buildUniqueSlug(dto.title, (candidate) =>
      this.posts.exists({ where: { slug: candidate } }),
    );
    const post = await this.posts.save(
      this.posts.create({
        ...dto,
        coverImage: dto.coverImage ?? null,
        slug,
        authorUserId: author.id,
        publishedAt:
          dto.status === BlogPostStatus.PUBLISHED ? new Date() : null,
      }),
    );
    return this.get(post.id);
  }

  async update(id: string, dto: UpdateBlogPostDto) {
    const post = await this.get(id);
    if (dto.title && dto.title !== post.title) {
      post.slug = await buildUniqueSlug(dto.title, async (candidate) => {
        const existing = await this.posts.findOne({
          where: { slug: candidate },
        });
        return Boolean(existing && existing.id !== id);
      });
    }
    const isNewlyPublished =
      dto.status === BlogPostStatus.PUBLISHED &&
      post.status !== BlogPostStatus.PUBLISHED;
    Object.assign(post, dto);
    if (isNewlyPublished) post.publishedAt = new Date();
    return this.posts.save(post);
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.posts.delete(id);
  }
}
