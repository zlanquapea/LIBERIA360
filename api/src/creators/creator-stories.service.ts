import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Creator } from "./entities/creator.entity";
import { CreatorVerificationStatus } from "./entities/creator.enums";
import {
  CreatorStory,
  CreatorStoryComment,
  CreatorStoryReaction,
  CreatorStoryReport,
  CreatorStoryStatus,
  CreatorStoryView,
  CreatorStoryVisibility,
  STORY_VISIBILITY_HOURS,
} from "./entities/creator-story.entity";
import {
  CreateCreatorStoryCommentDto,
  CreateCreatorStoryDto,
  CreateCreatorStoryReactionDto,
  ReportCreatorStoryDto,
} from "./dto/create-creator-story.dto";
import { CreatorFollow } from "./entities/creator-follow.entity";
import { User } from "../users/entities/user.entity";
import { toPublicProfile } from "../users/user.serializer";

@Injectable()
export class CreatorStoriesService {
  constructor(
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(CreatorStory)
    private readonly storyRepo: Repository<CreatorStory>,
    @InjectRepository(CreatorStoryView)
    private readonly viewRepo: Repository<CreatorStoryView>,
    @InjectRepository(CreatorStoryReport)
    private readonly reportRepo: Repository<CreatorStoryReport>,
    @InjectRepository(CreatorStoryReaction)
    private readonly reactionRepo: Repository<CreatorStoryReaction>,
    @InjectRepository(CreatorStoryComment)
    private readonly commentRepo: Repository<CreatorStoryComment>,
    @InjectRepository(CreatorFollow)
    private readonly followRepo: Repository<CreatorFollow>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async listActive(viewerUserId?: string) {
    const follows = viewerUserId
      ? await this.followRepo.find({
          where: { userId: viewerUserId },
          select: { creatorId: true },
        })
      : [];
    const followedIds = new Set(follows.map((follow) => follow.creatorId));
    const stories = await this.storyRepo
      .createQueryBuilder("story")
      .innerJoinAndSelect("story.creator", "creator")
      .leftJoinAndSelect("creator.county", "county")
      .where("story.status = :status", { status: CreatorStoryStatus.APPROVED })
      .andWhere("story.published_at IS NOT NULL")
      .andWhere("story.expires_at > NOW()")
      .andWhere(
        "story.visibility = :publicVisibility OR (story.visibility = :followersVisibility AND story.creator_id IN (:...followedIds))",
        {
          publicVisibility: CreatorStoryVisibility.PUBLIC,
          followersVisibility: CreatorStoryVisibility.FOLLOWERS,
          followedIds:
            followedIds.size > 0
              ? [...followedIds]
              : ["00000000-0000-0000-0000-000000000000"],
        },
      )
      .orderBy("story.published_at", "DESC")
      .getMany();
    // Facebook-style "seen" ring on the story tray needs to know which of
    // these are already viewed by this exact viewer — one query for the
    // whole batch rather than N+1 per story. Same idea for "which emoji
    // (if any) did I already react with" so the viewer can open a story
    // already showing your prior tap highlighted.
    const viewedIds = await this.viewedStoryIds(viewerUserId, stories);
    const myReactions = await this.myReactions(viewerUserId, stories);
    return stories.map((story) =>
      this.serialize(
        story,
        viewedIds.has(story.id),
        myReactions.get(story.id) ?? null,
      ),
    );
  }

  async getStory(id: string, viewerUserId?: string) {
    const story = await this.assertViewable(
      await this.storyRepo.findOne({
        where: { id },
        relations: ["creator", "creator.county"],
      }),
      viewerUserId,
    );
    const viewedIds = await this.viewedStoryIds(viewerUserId, [story]);
    const myReactions = await this.myReactions(viewerUserId, [story]);
    return this.serialize(
      story,
      viewedIds.has(story.id),
      myReactions.get(story.id) ?? null,
    );
  }

  // Shared by getStory/toggleReaction/listComments/addComment — a story
  // that's expired, unapproved, or followers-only to a non-follower reads
  // as 404 everywhere, not just on the read endpoint (same "don't reveal
  // whether it ever existed" reasoning as getStory always used). Returns
  // the (now known non-null) story rather than using a TS assertion
  // signature — `asserts x is T` isn't allowed on an async method, since
  // the narrowing can't be guaranteed across an awaited boundary.
  private async assertViewable(
    story: CreatorStory | null,
    viewerUserId?: string,
  ): Promise<CreatorStory> {
    if (!story || !this.isPubliclyActive(story))
      throw new NotFoundException("Story not found");
    if (story.visibility === CreatorStoryVisibility.FOLLOWERS) {
      if (!viewerUserId) throw new NotFoundException("Story not found");
      const follow = await this.followRepo.findOne({
        where: { userId: viewerUserId, creatorId: story.creatorId },
      });
      if (!follow) throw new NotFoundException("Story not found");
    }
    return story;
  }

  private async myReactions(
    viewerUserId: string | undefined,
    stories: CreatorStory[],
  ): Promise<Map<string, string>> {
    if (!viewerUserId || stories.length === 0) return new Map();
    const reactions = await this.reactionRepo.find({
      where: {
        storyId: In(stories.map((story) => story.id)),
        userId: viewerUserId,
      },
    });
    return new Map(
      reactions.map((reaction) => [reaction.storyId, reaction.emoji]),
    );
  }

  private async viewedStoryIds(
    viewerUserId: string | undefined,
    stories: CreatorStory[],
  ): Promise<Set<string>> {
    if (!viewerUserId || stories.length === 0) return new Set();
    const views = await this.viewRepo.find({
      where: {
        storyId: In(stories.map((story) => story.id)),
        viewerUserId,
      },
      select: { storyId: true },
    });
    return new Set(views.map((view) => view.storyId));
  }

  async eligibility(userId: string) {
    const creator = await this.creatorRepo.findOne({ where: { userId } });
    return {
      eligible:
        creator?.verificationStatus === CreatorVerificationStatus.VERIFIED,
    };
  }

  async listMine(userId: string) {
    const creator = await this.getOwnedCreator(userId);
    await this.storyRepo
      .createQueryBuilder()
      .update(CreatorStory)
      .set({ status: CreatorStoryStatus.EXPIRED })
      .where("creator_id = :creatorId", { creatorId: creator.id })
      .andWhere("status = :status", { status: CreatorStoryStatus.APPROVED })
      .andWhere("expires_at IS NOT NULL AND expires_at <= NOW()")
      .execute();
    const stories = await this.storyRepo.find({
      where: { creatorId: creator.id },
      relations: ["creator"],
      order: { createdAt: "DESC" },
    });
    return stories.map((story) => this.serialize(story));
  }

  async create(userId: string, dto: CreateCreatorStoryDto) {
    const creator = await this.getOwnedCreator(userId);
    if (creator.verificationStatus !== CreatorVerificationStatus.VERIFIED) {
      throw new ForbiddenException(
        "Only approved creators can publish stories",
      );
    }
    const mediaUrl = dto.mediaUrl.trim();
    if (!mediaUrl) throw new BadRequestException("Story media is required");
    const publishedAt = new Date();
    const expiresAt = new Date(
      publishedAt.getTime() + STORY_VISIBILITY_HOURS * 60 * 60 * 1000,
    );
    const story = await this.storyRepo.save(
      this.storyRepo.create({
        creatorId: creator.id,
        mediaType: dto.mediaType,
        mediaUrl,
        caption: dto.caption?.trim() || null,
        visibility: dto.visibility ?? CreatorStoryVisibility.PUBLIC,
        status: CreatorStoryStatus.APPROVED,
        publishedAt,
        expiresAt,
        placeId: dto.placeId ?? null,
        eventId: dto.eventId ?? null,
        tripId: dto.tripId ?? null,
        creatorProfileId: dto.creatorProfileId ?? null,
      }),
    );
    const saved = await this.storyRepo.findOneOrFail({
      where: { id: story.id },
      relations: ["creator", "creator.county"],
    });
    return this.serialize(saved);
  }

  async recordView(id: string, viewerUserId: string) {
    const story = await this.storyRepo.findOne({ where: { id } });
    if (!story || !this.isPubliclyActive(story))
      throw new NotFoundException("Story not found");
    if (story.creator?.userId === viewerUserId)
      return { viewed: false, viewCount: story.viewCount };
    try {
      await this.viewRepo.insert(
        this.viewRepo.create({ storyId: id, viewerUserId }),
      );
      await this.storyRepo.increment({ id }, "viewCount", 1);
      story.viewCount += 1;
      return { viewed: true, viewCount: story.viewCount };
    } catch {
      return { viewed: false, viewCount: story.viewCount };
    }
  }

  async remove(userId: string, id: string) {
    const creator = await this.getOwnedCreator(userId);
    const story = await this.storyRepo.findOne({
      where: { id, creatorId: creator.id },
    });
    if (!story) throw new NotFoundException("Story not found");
    story.status = CreatorStoryStatus.DELETED;
    await this.storyRepo.save(story);
  }

  async report(userId: string, id: string, dto: ReportCreatorStoryDto) {
    const story = await this.storyRepo.findOne({ where: { id } });
    if (!story || !this.isPubliclyActive(story))
      throw new NotFoundException("Story not found");
    const existing = await this.reportRepo.findOne({
      where: { storyId: id, reporterUserId: userId },
    });
    if (existing) return { reported: true };
    await this.reportRepo.save(
      this.reportRepo.create({
        storyId: id,
        reporterUserId: userId,
        reason: dto.reason.trim(),
      }),
    );
    return { reported: true };
  }

  // Tapping the same emoji again removes it (toggle off); tapping a
  // different one swaps it — either way it's still "one reaction per
  // person", so `reactionCount` only moves on the create/remove edges,
  // never on a swap.
  async toggleReaction(
    userId: string,
    id: string,
    dto: CreateCreatorStoryReactionDto,
  ) {
    const story = await this.assertViewable(
      await this.storyRepo.findOne({ where: { id } }),
      userId,
    );
    const existing = await this.reactionRepo.findOne({
      where: { storyId: id, userId },
    });
    if (existing && existing.emoji === dto.emoji) {
      await this.reactionRepo.remove(existing);
      await this.storyRepo.decrement({ id }, "reactionCount", 1);
      return {
        reactionCount: Math.max(0, story.reactionCount - 1),
        myReaction: null,
      };
    }
    if (existing) {
      existing.emoji = dto.emoji;
      await this.reactionRepo.save(existing);
      return { reactionCount: story.reactionCount, myReaction: dto.emoji };
    }
    await this.reactionRepo.save(
      this.reactionRepo.create({ storyId: id, userId, emoji: dto.emoji }),
    );
    await this.storyRepo.increment({ id }, "reactionCount", 1);
    return { reactionCount: story.reactionCount + 1, myReaction: dto.emoji };
  }

  async listComments(id: string, viewerUserId?: string) {
    await this.assertViewable(
      await this.storyRepo.findOne({ where: { id } }),
      viewerUserId,
    );
    const comments = await this.commentRepo.find({
      where: { storyId: id },
      order: { createdAt: "ASC" },
    });
    const users =
      comments.length > 0
        ? await this.userRepo.findBy({
            id: In(comments.map((comment) => comment.userId)),
          })
        : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    return comments.map((comment) =>
      this.serializeComment(comment, usersById.get(comment.userId) ?? null),
    );
  }

  async addComment(
    userId: string,
    id: string,
    dto: CreateCreatorStoryCommentDto,
  ) {
    await this.assertViewable(
      await this.storyRepo.findOne({ where: { id } }),
      userId,
    );
    const body = dto.body.trim();
    if (!body) throw new BadRequestException("Comment cannot be empty");
    const comment = await this.commentRepo.save(
      this.commentRepo.create({ storyId: id, userId, body }),
    );
    await this.storyRepo.increment({ id }, "commentCount", 1);
    const author = await this.userRepo.findOneBy({ id: userId });
    return this.serializeComment(comment, author ?? null);
  }

  async removeComment(userId: string, id: string, commentId: string) {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId, storyId: id },
    });
    if (!comment) throw new NotFoundException("Comment not found");
    const story = await this.storyRepo.findOne({
      where: { id },
      relations: ["creator"],
    });
    if (!story) throw new NotFoundException("Story not found");
    if (comment.userId !== userId && story.creator.userId !== userId) {
      throw new ForbiddenException("You cannot remove this comment");
    }
    await this.commentRepo.remove(comment);
    await this.storyRepo.decrement({ id }, "commentCount", 1);
  }

  private serializeComment(comment: CreatorStoryComment, user: User | null) {
    return {
      id: comment.id,
      storyId: comment.storyId,
      userId: comment.userId,
      body: comment.body,
      createdAt: comment.createdAt,
      // toPublicProfile (id + name only), not toPublicUser — GET comments
      // is reachable anonymously (OptionalJwtAuthGuard), so nothing more
      // than a name to attribute the comment to belongs in this response.
      // See toPublicUser's own doc comment for the PII this is protecting.
      user: user ? toPublicProfile(user) : null,
    };
  }

  private async getOwnedCreator(userId: string) {
    const creator = await this.creatorRepo.findOne({ where: { userId } });
    if (!creator)
      throw new NotFoundException("You do not have a creator profile yet");
    return creator;
  }

  private isPubliclyActive(story: CreatorStory) {
    return (
      story.status === CreatorStoryStatus.APPROVED &&
      Boolean(
        story.publishedAt &&
        story.expiresAt &&
        new Date(story.expiresAt).getTime() > Date.now(),
      )
    );
  }

  private serialize(
    story: CreatorStory,
    viewedByMe = false,
    myReaction: string | null = null,
  ) {
    return {
      id: story.id,
      creatorId: story.creatorId,
      mediaType: story.mediaType,
      mediaUrl: story.mediaUrl,
      caption: story.caption,
      status: story.status,
      visibility: story.visibility,
      placeId: story.placeId,
      eventId: story.eventId,
      tripId: story.tripId,
      creatorProfileId: story.creatorProfileId,
      viewCount: story.viewCount,
      viewedByMe,
      reactionCount: story.reactionCount,
      commentCount: story.commentCount,
      myReaction,
      publishedAt: story.publishedAt,
      expiresAt: story.expiresAt,
      createdAt: story.createdAt,
      updatedAt: story.updatedAt,
      creator: {
        id: story.creator?.id ?? story.creatorId,
        name: story.creator?.name ?? "Creator",
        username: story.creator?.username ?? "creator",
        profileImage: story.creator?.profileImage ?? null,
        verificationStatus: story.creator?.verificationStatus ?? "unverified",
      },
    };
  }
}
