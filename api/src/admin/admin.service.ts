import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { Review } from "../reviews/entities/review.entity";
import { VerificationStatus } from "../places/entities/place.enums";

const MODERATION_QUEUE_REVIEW_LIMIT = 20;

export interface ModerationQueue {
  pendingBusinesses: Business[];
  recentReviews: Review[];
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async setPlaceVerification(
    adminUserId: string,
    placeId: string,
    status: VerificationStatus,
  ): Promise<Place> {
    const place = await this.placeRepo.findOne({ where: { id: placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${placeId}" not found`);
    }
    place.verificationStatus = status;
    place.verifiedByUserId = adminUserId;
    place.verifiedAt = new Date();
    return this.placeRepo.save(place);
  }

  async setBusinessVerification(
    adminUserId: string,
    businessId: string,
    status: VerificationStatus,
  ): Promise<Business> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    business.verificationStatus = status;
    business.verifiedByUserId = adminUserId;
    business.verifiedAt = new Date();
    const saved = await this.businessRepo.save(business);
    return this.businessRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** Tech Spec §7/§8 — pending business claims and recent reviews, for an
   * admin to review. "Flagged content" from the same spec bullet isn't
   * included: there's no reporting/flagging mechanism in the schema yet,
   * and building one is a bigger, separate feature the one-line spec
   * mention doesn't give enough to design against. */
  async getModerationQueue(): Promise<ModerationQueue> {
    const [pendingBusinesses, recentReviews] = await Promise.all([
      this.businessRepo.find({
        where: { verificationStatus: VerificationStatus.UNVERIFIED },
        order: { createdAt: "DESC" },
      }),
      this.reviewRepo.find({
        relations: ["user", "place"],
        order: { createdAt: "DESC" },
        take: MODERATION_QUEUE_REVIEW_LIMIT,
      }),
    ]);
    return { pendingBusinesses, recentReviews };
  }
}
