import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Advertisement } from "./entities/advertisement.entity";
import { AdvertisementReviewStatus } from "./entities/advertisement.enums";
import { CreateAdvertisementDto } from "./dto/create-advertisement.dto";
import { UpdateAdvertisementDto } from "./dto/update-advertisement.dto";
import { NotificationsService } from "../notifications/notifications.service";
import { UsersService } from "../users/users.service";

const ACTIVE_ADS_DEFAULT_LIMIT = 12;

/** Where an admin goes to act on a pending ad — same moderation queue
 * page as pending places/businesses (its own "Pending advertisements"
 * section), not a route of its own. Previously pointed at
 * "/admin/advertisements", which doesn't exist and 404'd every admin who
 * clicked the notification — mirrors PlacesService/BusinessesService's
 * MODERATION_QUEUE_LINK. */
const AD_MODERATION_QUEUE_LINK = "/admin/content/moderation";

@Injectable()
export class AdvertisementsService {
  constructor(
    @InjectRepository(Advertisement)
    private readonly adRepo: Repository<Advertisement>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  /** Broadcasts an in-app notification to every admin (see
   * UsersService.findAdminIds) when an ad enters SUBMITTED_FOR_REVIEW —
   * mirrors PlacesService.notifyAdminsOfPendingPlace. */
  private async notifyAdminsOfPendingAd(ad: Advertisement): Promise<void> {
    const adminIds = await this.usersService.findAdminIds();
    await this.notificationsService.createMany(adminIds, {
      type: "admin.advertisement_pending_review",
      title: "Advertisement pending review",
      body: `"${ad.title}" is waiting for a review decision.`,
      link: AD_MODERATION_QUEUE_LINK,
    });
  }

  /** Self-service submission — single step, straight to
   * SUBMITTED_FOR_REVIEW, mirroring PlacesService.submitPlace rather than
   * BusinessContent's draft-then-submit two-step: there's no reason
   * posting an ad needs to be two separate actions. Not publicly visible
   * or eligible for placement until an admin approves it (see
   * AdvertisementReviewStatus's doc comment). */
  async create(
    userId: string,
    dto: CreateAdvertisementDto,
  ): Promise<Advertisement> {
    const ad = this.adRepo.create({
      ownerUserId: userId,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      images: dto.images ?? [],
      priceLabel: dto.priceLabel ?? null,
      contactPhone: dto.contactPhone ?? null,
      contactWhatsapp: dto.contactWhatsapp ?? null,
      contactEmail: dto.contactEmail ?? null,
      externalLink: dto.externalLink ?? null,
      reviewStatus: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW,
      submittedAt: new Date(),
    });
    const saved = await this.adRepo.save(ad);
    await this.notifyAdminsOfPendingAd(saved);
    return this.adRepo.findOneOrFail({ where: { id: saved.id } });
  }

  private async findOwnedOrFail(
    userId: string,
    id: string,
  ): Promise<Advertisement> {
    const ad = await this.adRepo.findOne({ where: { id } });
    if (!ad) {
      throw new NotFoundException(`Advertisement "${id}" not found`);
    }
    if (ad.ownerUserId !== userId) {
      throw new ForbiddenException("You don't manage this advertisement");
    }
    return ad;
  }

  /** The owner's own dashboard — every status, not just approved, so a
   * pending/rejected/suspended ad is still visible to whoever posted it. */
  findMine(userId: string): Promise<Advertisement[]> {
    return this.adRepo.find({
      where: { ownerUserId: userId },
      order: { createdAt: "DESC" },
    });
  }

  /** GET /advertisements/:id for the owner's own detail view (edit form,
   * metrics link). Admins reach any ad through the admin moderation
   * endpoints instead, not this one. */
  findOne(userId: string, id: string): Promise<Advertisement> {
    return this.findOwnedOrFail(userId, id);
  }

  /** Editing a REJECTED ad resubmits it automatically — same "an owner
   * acting on reviewer feedback shouldn't also have to find a separate
   * 'resubmit' button" reasoning as BusinessesService.updateMine. A
   * SUSPENDED ad does NOT auto-resubmit: lifting a suspension is an
   * explicit admin action, not something an edit should silently undo. */
  async update(
    userId: string,
    id: string,
    dto: UpdateAdvertisementDto,
  ): Promise<Advertisement> {
    const ad = await this.findOwnedOrFail(userId, id);
    const isResubmission =
      ad.reviewStatus === AdvertisementReviewStatus.REJECTED;

    Object.assign(ad, dto);
    if (isResubmission) {
      ad.reviewStatus = AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW;
      ad.submittedAt = new Date();
      ad.rejectionReason = null;
    }
    await this.adRepo.save(ad);
    if (isResubmission) {
      await this.notifyAdminsOfPendingAd(ad);
    }
    return this.adRepo.findOneOrFail({ where: { id } });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwnedOrFail(userId, id);
    await this.adRepo.delete({ id });
  }

  /** Public "Sponsored" placement feed — approved only. Simple newest-
   * first capped list rather than paginated, same shape as
   * SponsoredPlacementsService.findActive: this feeds a compact
   * banner/carousel, not a browsable directory. */
  findActive(limit = ACTIVE_ADS_DEFAULT_LIMIT): Promise<Advertisement[]> {
    return this.adRepo.find({
      where: { reviewStatus: AdvertisementReviewStatus.APPROVED },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  /** Public ad detail page ("See more" from the carousel) — approved only,
   * same visibility rule as findActive, so a dismissed/rejected/pending ad
   * (or one that's since been suspended) isn't reachable by guessing its
   * id once it's no longer meant to be public. */
  async findActiveOne(id: string): Promise<Advertisement> {
    const ad = await this.adRepo.findOne({
      where: { id, reviewStatus: AdvertisementReviewStatus.APPROVED },
    });
    if (!ad) {
      throw new NotFoundException(`Advertisement "${id}" not found`);
    }
    return ad;
  }
}
