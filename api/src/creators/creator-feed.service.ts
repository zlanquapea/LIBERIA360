import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { toPublicUser } from "../users/user.serializer";
import { Creator } from "./entities/creator.entity";
import { CreatorFollow } from "./entities/creator-follow.entity";
import { CreatorPost } from "./entities/creator-post.entity";
import {
  CreatorPostComment,
  CreatorPostLike,
  CreatorPostSave,
} from "./entities/creator-post-interaction.entity";
import { CreatorPostStatus } from "./entities/creator-post.enums";
import { CreateCreatorPostCommentDto } from "./dto/create-creator-post-comment.dto";
import { CreateCreatorPostDto } from "./dto/create-creator-post.dto";

export interface PaginatedCreatorPosts {
  data: ReturnType<CreatorFeedService["serializePost"]>[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class CreatorFeedService {
  constructor(
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(CreatorPost)
    private readonly postRepo: Repository<CreatorPost>,
    @InjectRepository(CreatorPostLike)
    private readonly likeRepo: Repository<CreatorPostLike>,
    @InjectRepository(CreatorPostSave)
    private readonly saveRepo: Repository<CreatorPostSave>,
    @InjectRepository(CreatorPostComment)
    private readonly commentRepo: Repository<CreatorPostComment>,
    @InjectRepository(CreatorFollow)
    private readonly followRepo: Repository<CreatorFollow>,
  ) {}

  async findPublicFeed(
    params: {
      page?: number;
      limit?: number;
      userId?: string;
      creatorId?: string;
      creatorIds?: string[];
    } = {},
  ): Promise<PaginatedCreatorPosts> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const [posts, total] = await this.postRepo
      .createQueryBuilder("post")
      .innerJoinAndSelect("post.creator", "creator")
      .leftJoinAndSelect("creator.county", "county")
      .where("post.status = :status", { status: CreatorPostStatus.PUBLISHED })
      .andWhere(
        params.creatorId ? "post.creator_id = :creatorId" : "1 = 1",
        params.creatorId ? { creatorId: params.creatorId } : {},
      )
      .andWhere(
        params.creatorIds
          ? params.creatorIds.length > 0
            ? "post.creator_id IN (:...creatorIds)"
            : "1 = 0"
          : "1 = 1",
        params.creatorIds && params.creatorIds.length > 0
          ? { creatorIds: params.creatorIds }
          : {},
      )
      .orderBy("post.createdAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const ids = posts.map((post) => post.id);
    const [likes, saves] =
      params.userId && ids.length > 0
        ? await Promise.all([
            this.likeRepo.find({
              where: { userId: params.userId, postId: In(ids) },
            }),
            this.saveRepo.find({
              where: { userId: params.userId, postId: In(ids) },
            }),
          ])
        : [[], []];
    const likedIds = new Set(likes.map((like) => like.postId));
    const savedIds = new Set(saves.map((save) => save.postId));

    return {
      data: posts.map((post) =>
        this.serializePost(post, likedIds.has(post.id), savedIds.has(post.id)),
      ),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findFollowedFeed(
    userId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedCreatorPosts> {
    const follows = await this.followRepo.find({
      where: { userId },
      select: { creatorId: true },
    });
    return this.findPublicFeed({
      ...params,
      userId,
      creatorIds: follows.map((follow) => follow.creatorId),
    });
  }

  async findPublicFeedForCreator(
    username: string,
    params: { page?: number; limit?: number } = {},
  ) {
    const creator = await this.creatorRepo.findOne({ where: { username } });
    if (!creator)
      throw new NotFoundException(`Creator "${username}" not found`);
    return this.findPublicFeed({ ...params, creatorId: creator.id });
  }

  async findMine(
    userId: string,
  ): Promise<ReturnType<CreatorFeedService["serializePost"]>[]> {
    const creator = await this.getOwnedCreator(userId);
    const posts = await this.postRepo.find({
      where: { creatorId: creator.id },
      relations: ["creator", "creator.county"],
      order: { createdAt: "DESC" },
    });
    return posts.map((post) => this.serializePost(post));
  }

  async create(userId: string, dto: CreateCreatorPostDto) {
    const creator = await this.getOwnedCreator(userId);
    const mediaUrl = dto.mediaUrl.trim();
    const caption = dto.caption?.trim() || null;
    if (dto.mediaType === "text" && !caption)
      throw new ForbiddenException("A text post needs some text");
    if (dto.mediaType !== "text" && !mediaUrl)
      throw new ForbiddenException("A post needs an image or video link");
    const post = await this.postRepo.save(
      this.postRepo.create({
        creatorId: creator.id,
        mediaType: dto.mediaType,
        mediaUrl: dto.mediaType === "text" ? "" : mediaUrl,
        caption,
        status: CreatorPostStatus.PUBLISHED,
      }),
    );
    const saved = await this.postRepo.findOneOrFail({
      where: { id: post.id },
      relations: ["creator", "creator.county"],
    });
    return this.serializePost(saved);
  }

  async update(
    userId: string,
    postId: string,
    dto: Partial<CreateCreatorPostDto>,
  ) {
    const post = await this.getOwnedPost(userId, postId);
    const nextMediaType = dto.mediaType ?? post.mediaType;
    const nextMediaUrl =
      dto.mediaUrl !== undefined ? dto.mediaUrl.trim() : post.mediaUrl;
    const nextCaption =
      dto.caption !== undefined ? dto.caption.trim() || null : post.caption;
    if (nextMediaType === "text" && !nextCaption)
      throw new ForbiddenException("A text post needs some text");
    if (nextMediaType !== "text" && !nextMediaUrl)
      throw new ForbiddenException("A post needs an image or video link");
    post.mediaType = nextMediaType;
    post.mediaUrl = nextMediaType === "text" ? "" : nextMediaUrl;
    post.caption = nextCaption;
    await this.postRepo.save(post);
    const saved = await this.postRepo.findOneOrFail({
      where: { id: post.id },
      relations: ["creator", "creator.county"],
    });
    return this.serializePost(saved);
  }

  async remove(userId: string, postId: string): Promise<void> {
    await this.getOwnedPost(userId, postId);
    await this.postRepo.delete({ id: postId });
  }

  async toggleLike(userId: string, postId: string) {
    const post = await this.getPublishedPost(postId);
    const existing = await this.likeRepo.findOne({ where: { postId, userId } });
    if (existing) {
      await this.likeRepo.remove(existing);
      post.likeCount = Math.max(0, post.likeCount - 1);
      await this.postRepo.save(post);
      return { liked: false, likeCount: post.likeCount };
    }
    await this.likeRepo.save(this.likeRepo.create({ postId, userId }));
    post.likeCount += 1;
    await this.postRepo.save(post);
    return { liked: true, likeCount: post.likeCount };
  }

  async toggleSave(userId: string, postId: string) {
    const post = await this.getPublishedPost(postId);
    const existing = await this.saveRepo.findOne({ where: { postId, userId } });
    if (existing) {
      await this.saveRepo.remove(existing);
      post.saveCount = Math.max(0, post.saveCount - 1);
      await this.postRepo.save(post);
      return { saved: false, saveCount: post.saveCount };
    }
    await this.saveRepo.save(this.saveRepo.create({ postId, userId }));
    post.saveCount += 1;
    await this.postRepo.save(post);
    return { saved: true, saveCount: post.saveCount };
  }

  async recordShare(postId: string) {
    const post = await this.getPublishedPost(postId);
    post.shareCount += 1;
    await this.postRepo.save(post);
    return { shareCount: post.shareCount };
  }

  async findComments(postId: string) {
    await this.getPublishedPost(postId);
    const comments = await this.commentRepo.find({
      where: { postId },
      relations: ["user"],
      order: { createdAt: "ASC" },
    });
    return comments.map((comment) => this.serializeComment(comment));
  }

  async addComment(
    userId: string,
    postId: string,
    dto: CreateCreatorPostCommentDto,
  ) {
    const post = await this.getPublishedPost(postId);
    const body = dto.body.trim();
    if (!body) throw new ForbiddenException("Comment cannot be empty");
    const comment = await this.commentRepo.save(
      this.commentRepo.create({ postId, userId, body }),
    );
    post.commentCount += 1;
    await this.postRepo.save(post);
    const saved = await this.commentRepo.findOneOrFail({
      where: { id: comment.id },
      relations: ["user"],
    });
    return this.serializeComment(saved);
  }

  async removeComment(
    userId: string,
    postId: string,
    commentId: string,
  ): Promise<void> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, postId },
    });
    if (!comment)
      throw new NotFoundException(`Comment "${commentId}" not found`);
    const post = await this.postRepo.findOne({
      where: { id: postId },
      relations: ["creator"],
    });
    if (!post) throw new NotFoundException(`Post "${postId}" not found`);
    if (comment.userId !== userId && post.creator.userId !== userId) {
      throw new ForbiddenException("You cannot remove this comment");
    }
    await this.commentRepo.remove(comment);
    post.commentCount = Math.max(0, post.commentCount - 1);
    await this.postRepo.save(post);
  }

  private async getOwnedCreator(userId: string): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({ where: { userId } });
    if (!creator)
      throw new NotFoundException("You do not have a creator profile yet");
    return creator;
  }

  private async getOwnedPost(
    userId: string,
    postId: string,
  ): Promise<CreatorPost> {
    const post = await this.postRepo.findOne({
      where: { id: postId },
      relations: ["creator"],
    });
    if (!post) throw new NotFoundException(`Post "${postId}" not found`);
    if (post.creator.userId !== userId)
      throw new ForbiddenException("This post isn't yours");
    return post;
  }

  private async getPublishedPost(postId: string): Promise<CreatorPost> {
    const post = await this.postRepo.findOne({
      where: { id: postId, status: CreatorPostStatus.PUBLISHED },
    });
    if (!post)
      throw new NotFoundException(`Published post "${postId}" not found`);
    return post;
  }

  private serializePost(
    post: CreatorPost,
    viewerLiked = false,
    viewerSaved = false,
  ) {
    return {
      id: post.id,
      creatorId: post.creatorId,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      caption: post.caption,
      status: post.status,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      saveCount: post.saveCount,
      shareCount: post.shareCount,
      creator: {
        id: post.creator?.id ?? post.creatorId,
        name: post.creator?.name ?? "Creator",
        username: post.creator?.username ?? "creator",
        profileImage: post.creator?.profileImage ?? null,
        verificationStatus: post.creator?.verificationStatus ?? "unverified",
        availabilityStatus:
          post.creator?.availabilityStatus ?? "accepting_requests",
        category: post.creator?.category,
        county: post.creator?.county ?? null,
      },
      viewerLiked,
      viewerSaved,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private serializeComment(comment: CreatorPostComment) {
    return {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      body: comment.body,
      user: comment.user ? toPublicUser(comment.user) : null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
