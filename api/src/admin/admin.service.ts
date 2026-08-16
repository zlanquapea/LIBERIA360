import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { Review } from "../reviews/entities/review.entity";
import { VerificationStatus } from "../places/entities/place.enums";
import { PlaceFreshnessReport } from "../freshness/entities/place-freshness-report.entity";
import { FreshnessResponse } from "../freshness/entities/place-freshness-report.enums";
import { AdminAuditService } from "./admin-audit.service";

const MODERATION_QUEUE_REVIEW_LIMIT = 20;

// How many distinct users have to say "no longer here" before a place is
// worth an admin's attention — one report could just be a mistake or a
// bad day; a handful of independent reports is a real signal a catalog
// too large to manually re-verify can't otherwise catch.
const FRESHNESS_FLAG_THRESHOLD = 3;
// Only recent reports count — an old wave of reports about a place that
// was later fixed shouldn't keep flagging it forever.
const FRESHNESS_WINDOW_DAYS = 90;

export interface PossiblyClosedPlace {
  place: Place;
  noLongerHereCount: number;
}

export interface ModerationQueue {
  pendingBusinesses: Business[];
  recentReviews: Review[];
  possiblyClosedPlaces: PossiblyClosedPlace[];
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
    @InjectRepository(PlaceFreshnessReport)
    private readonly freshnessReportRepo: Repository<PlaceFreshnessReport>,
    private readonly adminAuditService: AdminAuditService,
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
    const previousStatus = place.verificationStatus;
    place.verificationStatus = status;
    place.verifiedByUserId = adminUserId;
    place.verifiedAt = new Date();
    const saved = await this.placeRepo.save(place);
    await this.adminAuditService.log(
      adminUserId,
      "place.verification_changed",
      "place",
      placeId,
      { from: previousStatus, to: status },
    );
    return saved;
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
    const previousStatus = business.verificationStatus;
    business.verificationStatus = status;
    business.verifiedByUserId = adminUserId;
    business.verifiedAt = new Date();
    const saved = await this.businessRepo.save(business);
    await this.adminAuditService.log(
      adminUserId,
      "business.verification_changed",
      "business",
      businessId,
      { from: previousStatus, to: status },
    );
    return this.businessRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** Tech Spec §7/§8 — pending business claims, recent reviews, and
   * (Phase 4) crowdsourced "no longer here" reports, for an admin to
   * review. "Flagged content" from the spec bullet was originally left
   * out for lack of a reporting mechanism in the schema — PlaceFreshnessReport
   * is that mechanism now, scoped to the one flag a catalog this size
   * actually needs: whether a place has closed or moved. */
  async getModerationQueue(): Promise<ModerationQueue> {
    const [pendingBusinesses, recentReviews, possiblyClosedPlaces] =
      await Promise.all([
        this.businessRepo.find({
          where: { verificationStatus: VerificationStatus.UNVERIFIED },
          order: { createdAt: "DESC" },
        }),
        this.reviewRepo.find({
          relations: ["user", "place"],
          order: { createdAt: "DESC" },
          take: MODERATION_QUEUE_REVIEW_LIMIT,
        }),
        this.findPossiblyClosedPlaces(),
      ]);
    return { pendingBusinesses, recentReviews, possiblyClosedPlaces };
  }

  private async findPossiblyClosedPlaces(): Promise<PossiblyClosedPlace[]> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - FRESHNESS_WINDOW_DAYS);

    const rows = await this.freshnessReportRepo
      .createQueryBuilder("report")
      .select("report.placeId", "placeId")
      .addSelect("COUNT(*)", "count")
      .where("report.response = :response", {
        response: FreshnessResponse.NO_LONGER_HERE,
      })
      .andWhere("report.createdAt >= :windowStart", { windowStart })
      .groupBy("report.placeId")
      .having("COUNT(*) >= :threshold", {
        threshold: FRESHNESS_FLAG_THRESHOLD,
      })
      .orderBy("COUNT(*)", "DESC")
      .getRawMany<{ placeId: string; count: string }>();

    if (rows.length === 0) return [];

    const places = await this.placeRepo.find({
      where: rows.map((r) => ({ id: r.placeId })),
    });
    const placeById = new Map(places.map((p) => [p.id, p]));

    return rows
      .filter((r) => placeById.has(r.placeId))
      .map((r) => ({
        place: placeById.get(r.placeId)!,
        noLongerHereCount: parseInt(r.count, 10),
      }));
  }
}
