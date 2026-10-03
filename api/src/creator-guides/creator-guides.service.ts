import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Creator } from "../creators/entities/creator.entity";
import { Place } from "../places/entities/place.entity";
import { PlaceReviewStatus } from "../places/entities/place.enums";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import {
  BudgetBand,
  ItineraryKind,
  TripVisibility,
} from "../itineraries/entities/itinerary.enums";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";
import { buildUniqueSlug } from "../common/slugify";
import {
  CreatorGuide,
  CreatorGuideStop,
} from "./entities/creator-guide.entity";
import { CreatorGuideStatus } from "./entities/creator-guide.enums";
import { SavedGuide } from "./entities/saved-guide.entity";
import {
  CreateCreatorGuideDto,
  CreatorGuideStopDto,
  QueryCreatorGuidesDto,
  ReviewCreatorGuideDto,
  UpdateCreatorGuideDto,
} from "./dto/upsert-creator-guide.dto";

const ADMIN_QUEUE_LINK = "/admin/content/moderation#guides";

/** Who wrote a guide, without anything private from the creator's user
 * account. */
export interface GuideCreatorSummary {
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  category: string;
  verificationStatus: string;
}

export interface GuideStopView {
  day: number;
  note: string | null;
  place: Place;
}

export interface GuideView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: string | null;
  videoUrl: string | null;
  status: CreatorGuideStatus;
  rejectionReason: string | null;
  mediaPermissionConfirmedAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  creator: GuideCreatorSummary;
  // Only approved places are shown; a place removed from the catalog
  // simply drops out of the guide.
  stops: GuideStopView[];
  dayCount: number;
}

@Injectable()
export class CreatorGuidesService {
  constructor(
    @InjectRepository(CreatorGuide)
    private readonly guideRepo: Repository<CreatorGuide>,
    @InjectRepository(SavedGuide)
    private readonly savedRepo: Repository<SavedGuide>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(Itinerary)
    private readonly itineraryRepo: Repository<Itinerary>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  // ---------------------------------------------------------------------
  // Creator side

  async listMine(userId: string): Promise<GuideView[]> {
    const creator = await this.getCreator(userId);
    const guides = await this.guideRepo.find({
      where: { creatorId: creator.id },
      order: { updatedAt: "DESC" },
    });
    return this.toViews(guides);
  }

  async create(userId: string, dto: CreateCreatorGuideDto): Promise<GuideView> {
    const creator = await this.getCreator(userId);
    const stops = await this.validateStops(dto.stops);
    const slug = await buildUniqueSlug(
      dto.title,
      (candidate) => this.guideRepo.exists({ where: { slug: candidate } }),
      "guide",
    );
    const guide = await this.guideRepo.save(
      this.guideRepo.create({
        creatorId: creator.id,
        creator,
        title: dto.title.trim(),
        slug,
        summary: dto.summary.trim(),
        coverImage: dto.coverImage || null,
        videoUrl: dto.videoUrl || null,
        stops,
        status: CreatorGuideStatus.DRAFT,
        mediaPermissionConfirmedAt: dto.mediaPermissionConfirmed
          ? new Date()
          : null,
      }),
    );
    return this.toView(guide);
  }

  /** Editing a published or pending guide sends it back for review, so
   * nothing reaches the public unmoderated; editing a rejected guide
   * returns it to draft. Changing the media clears the permission tick. */
  async update(
    userId: string,
    id: string,
    dto: UpdateCreatorGuideDto,
  ): Promise<GuideView> {
    const guide = await this.getOwned(userId, id);
    const mediaChanged =
      (dto.coverImage !== undefined &&
        (dto.coverImage || null) !== guide.coverImage) ||
      (dto.videoUrl !== undefined && (dto.videoUrl || null) !== guide.videoUrl);

    if (dto.title !== undefined) guide.title = dto.title.trim();
    if (dto.summary !== undefined) guide.summary = dto.summary.trim();
    if (dto.coverImage !== undefined) guide.coverImage = dto.coverImage || null;
    if (dto.videoUrl !== undefined) guide.videoUrl = dto.videoUrl || null;
    if (dto.stops !== undefined) {
      guide.stops = await this.validateStops(dto.stops);
    }
    if (dto.mediaPermissionConfirmed === true) {
      guide.mediaPermissionConfirmedAt = new Date();
    } else if (dto.mediaPermissionConfirmed === false || mediaChanged) {
      guide.mediaPermissionConfirmedAt = null;
    }

    if (
      guide.status === CreatorGuideStatus.PUBLISHED ||
      guide.status === CreatorGuideStatus.PENDING_REVIEW
    ) {
      this.assertSubmittable(guide);
      const wasPublished = guide.status === CreatorGuideStatus.PUBLISHED;
      guide.status = CreatorGuideStatus.PENDING_REVIEW;
      await this.guideRepo.save(guide);
      if (wasPublished) await this.notifyAdmins(guide);
    } else {
      if (guide.status === CreatorGuideStatus.REJECTED) {
        guide.status = CreatorGuideStatus.DRAFT;
      }
      await this.guideRepo.save(guide);
    }
    return this.toView(guide);
  }

  async submit(userId: string, id: string): Promise<GuideView> {
    const guide = await this.getOwned(userId, id);
    if (guide.status === CreatorGuideStatus.PUBLISHED) {
      throw new ConflictException("This guide is already published");
    }
    this.assertSubmittable(guide);
    guide.status = CreatorGuideStatus.PENDING_REVIEW;
    guide.rejectionReason = null;
    await this.guideRepo.save(guide);
    await this.notifyAdmins(guide);
    return this.toView(guide);
  }

  async remove(userId: string, id: string): Promise<void> {
    const guide = await this.getOwned(userId, id);
    await this.guideRepo.remove(guide);
  }

  // ---------------------------------------------------------------------
  // Moderation

  async listPending(): Promise<GuideView[]> {
    const guides = await this.guideRepo.find({
      where: { status: CreatorGuideStatus.PENDING_REVIEW },
      order: { updatedAt: "ASC" },
    });
    return this.toViews(guides);
  }

  async review(
    adminUserId: string,
    id: string,
    dto: ReviewCreatorGuideDto,
  ): Promise<GuideView> {
    const guide = await this.guideRepo.findOne({ where: { id } });
    if (!guide) throw new NotFoundException(`Guide "${id}" not found`);
    if (guide.status !== CreatorGuideStatus.PENDING_REVIEW) {
      throw new ConflictException(
        "Only guides waiting for review can be reviewed",
      );
    }
    const reason = dto.reason?.trim() || null;
    if (!dto.approve && !reason) {
      throw new BadRequestException("Tell the creator why it was declined");
    }
    guide.reviewedByUserId = adminUserId;
    if (dto.approve) {
      guide.status = CreatorGuideStatus.PUBLISHED;
      guide.publishedAt = guide.publishedAt ?? new Date();
      guide.rejectionReason = null;
    } else {
      guide.status = CreatorGuideStatus.REJECTED;
      guide.rejectionReason = reason;
    }
    await this.guideRepo.save(guide);
    await this.notificationsService.create(guide.creator.userId, {
      type: "guide.review_decided",
      title: dto.approve ? "Your guide is live" : "Your guide needs changes",
      body: dto.approve
        ? `"${guide.title}" is now published.`
        : `"${guide.title}" wasn't approved: ${reason}`,
      link: dto.approve
        ? `/creator-guides/${guide.slug}`
        : "/creators/me/guides",
    });
    return this.toView(guide);
  }

  // ---------------------------------------------------------------------
  // Public

  async listPublished(query: QueryCreatorGuidesDto): Promise<{
    data: GuideView[];
    meta: { total: number; page: number; limit: number };
  }> {
    const limit = query.limit ?? 12;
    const page = query.page ?? 1;
    const qb = this.guideRepo
      .createQueryBuilder("guide")
      .leftJoinAndSelect("guide.creator", "creator")
      .leftJoinAndSelect("creator.user", "user")
      .leftJoinAndSelect("creator.county", "county")
      .where("guide.status = :status", {
        status: CreatorGuideStatus.PUBLISHED,
      })
      .orderBy("guide.publishedAt", "DESC")
      .skip((page - 1) * limit)
      .take(limit);
    if (query.placeId) {
      qb.andWhere("guide.stops @> :stop::jsonb", {
        stop: JSON.stringify([{ placeId: query.placeId }]),
      });
    }
    if (query.creator) {
      qb.andWhere("creator.username = :username", {
        username: query.creator.toLowerCase(),
      });
    }
    const [guides, total] = await qb.getManyAndCount();
    return { data: await this.toViews(guides), meta: { total, page, limit } };
  }

  async findPublished(slug: string): Promise<GuideView> {
    const guide = await this.guideRepo.findOne({
      where: { slug, status: CreatorGuideStatus.PUBLISHED },
    });
    if (!guide) throw new NotFoundException(`Guide "${slug}" not found`);
    return this.toView(guide);
  }

  /** A creator can preview their own guide at any status. */
  async findMine(userId: string, id: string): Promise<GuideView> {
    return this.toView(await this.getOwned(userId, id));
  }

  // ---------------------------------------------------------------------
  // Travelers

  async save(userId: string, id: string): Promise<void> {
    await this.getPublishedById(id);
    const exists = await this.savedRepo.exists({
      where: { userId, guideId: id },
    });
    if (!exists) {
      await this.savedRepo.save(this.savedRepo.create({ userId, guideId: id }));
    }
  }

  async unsave(userId: string, id: string): Promise<void> {
    await this.savedRepo.delete({ userId, guideId: id });
  }

  async listSaved(userId: string): Promise<GuideView[]> {
    const saved = await this.savedRepo.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
    if (saved.length === 0) return [];
    const guides = await this.guideRepo.find({
      where: {
        id: In(saved.map((s) => s.guideId)),
        status: CreatorGuideStatus.PUBLISHED,
      },
    });
    const byId = new Map(guides.map((g) => [g.id, g]));
    return this.toViews(
      saved
        .map((s) => byId.get(s.guideId))
        .filter((g): g is CreatorGuide => !!g),
    );
  }

  async savedIds(userId: string): Promise<string[]> {
    const saved = await this.savedRepo.find({ where: { userId } });
    return saved.map((s) => s.guideId);
  }

  /** Starts a private trip from a published guide: the same places, day
   * by day, with the creator's notes. The traveler owns the copy and can
   * change anything; the guide itself is untouched. */
  async useAsTrip(userId: string, id: string): Promise<{ id: string }> {
    const guide = await this.getPublishedById(id);
    const view = await this.toView(guide);
    if (view.stops.length === 0) {
      throw new BadRequestException("This guide has no places to add");
    }
    const days = [...new Set(view.stops.map((s) => s.day))].sort(
      (a, b) => a - b,
    );
    const dayIndex = new Map(days.map((d, i) => [d, i + 1]));
    const orderInDay = new Map<number, number>();
    const stops = view.stops.map((s) => {
      const day = dayIndex.get(s.day)!;
      const order = orderInDay.get(day) ?? 0;
      orderInDay.set(day, order + 1);
      return { day, order, placeId: s.place.id, notes: s.note };
    });
    const trip = await this.itineraryRepo.save(
      this.itineraryRepo.create({
        userId,
        title: guide.title.slice(0, 200),
        kind: ItineraryKind.TRIP,
        durationDays: days.length,
        budgetBand: BudgetBand.MODERATE,
        interests: [],
        stops,
        visibility: TripVisibility.PRIVATE,
        description: `Based on "${guide.title}" by ${guide.creator.name} on LIBERIA360.`,
        destinationPlaceId: view.stops[0].place.id,
      }),
    );
    return { id: trip.id };
  }

  // ---------------------------------------------------------------------

  private async getCreator(userId: string): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({ where: { userId } });
    if (!creator) {
      throw new ForbiddenException(
        "Set up your creator profile before writing guides",
      );
    }
    return creator;
  }

  private async getOwned(userId: string, id: string): Promise<CreatorGuide> {
    const creator = await this.getCreator(userId);
    const guide = await this.guideRepo.findOne({ where: { id } });
    // Someone else's guide reads as not found, not forbidden.
    if (!guide || guide.creatorId !== creator.id) {
      throw new NotFoundException(`Guide "${id}" not found`);
    }
    return guide;
  }

  private async getPublishedById(id: string): Promise<CreatorGuide> {
    const guide = await this.guideRepo.findOne({
      where: { id, status: CreatorGuideStatus.PUBLISHED },
    });
    if (!guide) throw new NotFoundException(`Guide "${id}" not found`);
    return guide;
  }

  private assertSubmittable(guide: CreatorGuide): void {
    if (guide.stops.length === 0) {
      throw new BadRequestException("Add at least one place before submitting");
    }
    if (
      (guide.coverImage || guide.videoUrl) &&
      !guide.mediaPermissionConfirmedAt
    ) {
      throw new BadRequestException(
        "Confirm you have the right to share this guide's photos and video",
      );
    }
  }

  /** Only approved catalog places can go in a guide; duplicates are
   * dropped, keeping the first. */
  private async validateStops(
    input: CreatorGuideStopDto[],
  ): Promise<CreatorGuideStop[]> {
    const seen = new Set<string>();
    const stops = input.filter((s) => {
      if (seen.has(s.placeId)) return false;
      seen.add(s.placeId);
      return true;
    });
    if (stops.length === 0) return [];
    const found = await this.placeRepo.find({
      where: {
        id: In(stops.map((s) => s.placeId)),
        reviewStatus: PlaceReviewStatus.APPROVED,
      },
      select: ["id"],
    });
    const valid = new Set(found.map((p) => p.id));
    const missing = stops.filter((s) => !valid.has(s.placeId));
    if (missing.length > 0) {
      throw new BadRequestException(
        `These places aren't in the catalog: ${missing.map((s) => s.placeId).join(", ")}`,
      );
    }
    return stops.map((s) => ({
      placeId: s.placeId,
      day: s.day,
      note: s.note?.trim() || null,
    }));
  }

  private async notifyAdmins(guide: CreatorGuide): Promise<void> {
    const adminIds = await this.usersService.findAdminIds();
    await this.notificationsService.createMany(adminIds, {
      type: "admin.guide_pending_review",
      title: "Guide pending review",
      body: `"${guide.title}" by ${guide.creator.name} is waiting for review.`,
      link: ADMIN_QUEUE_LINK,
    });
  }

  private async toView(guide: CreatorGuide): Promise<GuideView> {
    return (await this.toViews([guide]))[0];
  }

  private async toViews(guides: CreatorGuide[]): Promise<GuideView[]> {
    const placeIds = [
      ...new Set(guides.flatMap((g) => g.stops.map((s) => s.placeId))),
    ];
    const places = placeIds.length
      ? await this.placeRepo.find({
          where: { id: In(placeIds), reviewStatus: PlaceReviewStatus.APPROVED },
          relations: ["category", "county"],
        })
      : [];
    const byId = new Map(places.map((p) => [p.id, p]));
    return guides.map((g) => {
      const stops = g.stops
        .map((s) => ({ day: s.day, note: s.note, place: byId.get(s.placeId) }))
        .filter((s): s is GuideStopView => !!s.place);
      return {
        id: g.id,
        slug: g.slug,
        title: g.title,
        summary: g.summary,
        coverImage: g.coverImage,
        videoUrl: g.videoUrl,
        status: g.status,
        rejectionReason: g.rejectionReason,
        mediaPermissionConfirmedAt: g.mediaPermissionConfirmedAt,
        publishedAt: g.publishedAt,
        updatedAt: g.updatedAt,
        creator: {
          id: g.creator.id,
          name: g.creator.name,
          username: g.creator.username,
          profileImage: g.creator.profileImage,
          category: g.creator.category,
          verificationStatus: g.creator.verificationStatus,
        },
        stops,
        dayCount: new Set(stops.map((s) => s.day)).size,
      };
    });
  }
}
