import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Creator } from "./entities/creator.entity";
import { CreatorVerificationStatus } from "./entities/creator.enums";
import {
  CreatorStory,
  CreatorStoryReport,
  CreatorStoryStatus,
  CreatorStoryView,
  CreatorStoryVisibility,
  STORY_VISIBILITY_HOURS,
} from "./entities/creator-story.entity";
import {
  CreateCreatorStoryDto,
  ReportCreatorStoryDto,
} from "./dto/create-creator-story.dto";
import { CreatorFollow } from "./entities/creator-follow.entity";

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
    @InjectRepository(CreatorFollow)
    private readonly followRepo: Repository<CreatorFollow>,
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
    return stories.map((story) => this.serialize(story));
  }

  async getStory(id: string, viewerUserId?: string) {
    const story = await this.storyRepo.findOne({
      where: { id },
      relations: ["creator", "creator.county"],
    });
    if (!story || !this.isPubliclyActive(story))
      throw new NotFoundException("Story not found");
    if (story.visibility === CreatorStoryVisibility.FOLLOWERS) {
      if (!viewerUserId) throw new NotFoundException("Story not found");
      const follow = await this.followRepo.findOne({
        where: { userId: viewerUserId, creatorId: story.creatorId },
      });
      if (!follow) throw new NotFoundException("Story not found");
    }
    return this.serialize(story);
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

  private serialize(story: CreatorStory) {
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
