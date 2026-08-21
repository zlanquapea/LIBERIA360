import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { BusinessReviewStatus } from "../businesses/entities/business.enums";
import { Creator } from "../creators/entities/creator.entity";
import { CreatorVerificationStatus } from "../creators/entities/creator.enums";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { User } from "../users/entities/user.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";
import { VerificationStatus } from "../places/entities/place.enums";
import { PlaceFreshnessReport } from "../freshness/entities/place-freshness-report.entity";
import { FreshnessResponse } from "../freshness/entities/place-freshness-report.enums";
import { ContentReport } from "../reports/entities/content-report.entity";
import {
  ReportReason,
  ReportTargetType,
} from "../reports/entities/content-report.enums";
import { AdminAuditService } from "./admin-audit.service";
import { RequestInfo } from "../common/request-info";

const NEW_USER_WINDOW_DAYS = 7;

const MODERATION_QUEUE_REVIEW_LIMIT = 20;

// How many distinct users have to say "no longer here" before a place is
// worth an admin's attention — one report could just be a mistake or a
// bad day; a handful of independent reports is a real signal a catalog
// too large to manually re-verify can't otherwise catch.
const FRESHNESS_FLAG_THRESHOLD = 3;
// Only recent reports count — an old wave of reports about a place that
// was later fixed shouldn't keep flagging it forever.
const FRESHNESS_WINDOW_DAYS = 90;

// Same "a handful of independent signals, not just one" reasoning as
// freshness reports above, applied to user-reported reviews/events.
const REPORT_FLAG_THRESHOLD = 3;
const REPORT_WINDOW_DAYS = 90;

export interface PossiblyClosedPlace {
  place: Place;
  noLongerHereCount: number;
}

export interface FlaggedContent {
  targetType: ReportTargetType;
  targetId: string;
  reportCount: number;
  reasons: Record<ReportReason, number>;
  review: Review | null;
  event: Event | null;
  business: Business | null;
}

export interface ModerationQueue {
  pendingBusinesses: Business[];
  recentReviews: Review[];
  possiblyClosedPlaces: PossiblyClosedPlace[];
  flaggedContent: FlaggedContent[];
}

// Real, honestly-computable numbers only — no revenue figure, since no
// money actually moves through the app yet (Booking.paymentStatus stays
// "unpaid" for every booking until a real MTN Mobile Money integration
// lands; see Booking's own doc comment). A fabricated dollar figure would
// be actively misleading on a super admin's dashboard.
export interface PlatformKpis {
  totalUsers: number;
  newUsersLast7Days: number;
  totalPlaces: number;
  totalBusinessListings: number;
  claimedBusinessCount: number; // ownerUserId set — a real business claimed it
  businessClaimRate: number; // 0–1, claimedBusinessCount / totalPlaces
  totalReviews: number;
  totalBookings: number;
  bookingsByStatus: Record<BookingStatus, number>;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(PlaceFreshnessReport)
    private readonly freshnessReportRepo: Repository<PlaceFreshnessReport>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(ContentReport)
    private readonly contentReportRepo: Repository<ContentReport>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  async setPlaceVerification(
    adminUserId: string,
    placeId: string,
    status: VerificationStatus,
    requestInfo?: RequestInfo,
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
      requestInfo,
    );
    return saved;
  }

  async setBusinessVerification(
    adminUserId: string,
    businessId: string,
    status: VerificationStatus,
    requestInfo?: RequestInfo,
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
      requestInfo,
    );
    return this.businessRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** The publish/moderation lifecycle transition — approve, reject,
   * request changes, or suspend — see BusinessReviewStatus's doc comment
   * for what each status means and how `reason` is used per-transition. */
  async setBusinessReviewStatus(
    adminUserId: string,
    businessId: string,
    status: BusinessReviewStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ): Promise<Business> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    const previousStatus = business.reviewStatus;
    business.reviewStatus = status;
    business.rejectionReason =
      status === BusinessReviewStatus.APPROVED ? null : (reason ?? null);
    business.reviewedByUserId = adminUserId;
    business.reviewedAt = new Date();
    const saved = await this.businessRepo.save(business);
    await this.adminAuditService.log(
      adminUserId,
      "business.review_status_changed",
      "business",
      businessId,
      { from: previousStatus, to: status, reason: reason ?? null },
      requestInfo,
    );
    return this.businessRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async setCreatorVerification(
    adminUserId: string,
    creatorId: string,
    status: CreatorVerificationStatus,
    requestInfo?: RequestInfo,
  ): Promise<Creator> {
    const creator = await this.creatorRepo.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException(`Creator "${creatorId}" not found`);
    }
    const previousStatus = creator.verificationStatus;
    creator.verificationStatus = status;
    creator.verifiedByUserId = adminUserId;
    creator.verifiedAt = new Date();
    const saved = await this.creatorRepo.save(creator);
    await this.adminAuditService.log(
      adminUserId,
      "creator.verification_changed",
      "creator",
      creatorId,
      { from: previousStatus, to: status },
      requestInfo,
    );
    return this.creatorRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** Tech Spec §7/§8 — pending business claims, recent reviews, and
   * "flagged content" for an admin to review. Two independent flagging
   * mechanisms feed this: `PlaceFreshnessReport` (whether a place has
   * closed or moved) and `ContentReport` (user-reported reviews/events —
   * see that entity's doc comment). */
  async getModerationQueue(): Promise<ModerationQueue> {
    const [
      pendingBusinesses,
      recentReviews,
      possiblyClosedPlaces,
      flaggedContent,
    ] = await Promise.all([
      // "Pending" now means "awaiting a review-lifecycle decision," not the
      // old "never been given a trust badge" (VerificationStatus stayed
      // UNVERIFIED forever on plenty of perfectly legitimate live
      // businesses — that was never a real signal of what needed
      // attention). SUBMITTED_FOR_REVIEW is a fresh claim; UNDER_REVIEW is
      // one an admin picked up but hasn't resolved yet — both belong here.
      this.businessRepo.find({
        where: [
          { reviewStatus: BusinessReviewStatus.SUBMITTED_FOR_REVIEW },
          { reviewStatus: BusinessReviewStatus.UNDER_REVIEW },
        ],
        order: { submittedAt: "DESC" },
      }),
      this.reviewRepo.find({
        relations: ["user", "place"],
        order: { createdAt: "DESC" },
        take: MODERATION_QUEUE_REVIEW_LIMIT,
      }),
      this.findPossiblyClosedPlaces(),
      this.findFlaggedContent(),
    ]);
    return {
      pendingBusinesses,
      recentReviews,
      possiblyClosedPlaces,
      flaggedContent,
    };
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

  private async findFlaggedContent(): Promise<FlaggedContent[]> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - REPORT_WINDOW_DAYS);

    const rows = await this.contentReportRepo
      .createQueryBuilder("report")
      .select("report.targetType", "targetType")
      .addSelect("report.targetId", "targetId")
      .addSelect("COUNT(*)", "count")
      .where("report.createdAt >= :windowStart", { windowStart })
      .groupBy("report.targetType")
      .addGroupBy("report.targetId")
      .having("COUNT(*) >= :threshold", { threshold: REPORT_FLAG_THRESHOLD })
      .orderBy("COUNT(*)", "DESC")
      .getRawMany<{
        targetType: ReportTargetType;
        targetId: string;
        count: string;
      }>();

    if (rows.length === 0) return [];

    const reviewIds = rows
      .filter((r) => r.targetType === ReportTargetType.REVIEW)
      .map((r) => r.targetId);
    const eventIds = rows
      .filter((r) => r.targetType === ReportTargetType.EVENT)
      .map((r) => r.targetId);
    const businessIds = rows
      .filter((r) => r.targetType === ReportTargetType.BUSINESS)
      .map((r) => r.targetId);

    const [reviews, events, businesses, allReports] = await Promise.all([
      reviewIds.length
        ? this.reviewRepo.find({
            where: reviewIds.map((id) => ({ id })),
            relations: ["user"],
          })
        : Promise.resolve([]),
      eventIds.length
        ? this.eventRepo.find({ where: eventIds.map((id) => ({ id })) })
        : Promise.resolve([]),
      businessIds.length
        ? this.businessRepo.find({ where: businessIds.map((id) => ({ id })) })
        : Promise.resolve([]),
      this.contentReportRepo.find({
        where: rows.map((r) => ({
          targetType: r.targetType,
          targetId: r.targetId,
        })),
      }),
    ]);
    const reviewById = new Map(reviews.map((r) => [r.id, r]));
    const eventById = new Map(events.map((e) => [e.id, e]));
    const businessById = new Map(businesses.map((b) => [b.id, b]));

    return rows.map((r) => {
      const reasons: Record<ReportReason, number> = {
        [ReportReason.SPAM]: 0,
        [ReportReason.INAPPROPRIATE]: 0,
        [ReportReason.FAKE]: 0,
        [ReportReason.FRAUDULENT]: 0,
        [ReportReason.MISLEADING_OFFER]: 0,
        [ReportReason.COPYRIGHT]: 0,
        [ReportReason.OTHER]: 0,
      };
      for (const report of allReports) {
        if (
          report.targetType === r.targetType &&
          report.targetId === r.targetId
        ) {
          reasons[report.reason]++;
        }
      }
      return {
        targetType: r.targetType,
        targetId: r.targetId,
        reportCount: parseInt(r.count, 10),
        reasons,
        review:
          r.targetType === ReportTargetType.REVIEW
            ? (reviewById.get(r.targetId) ?? null)
            : null,
        event:
          r.targetType === ReportTargetType.EVENT
            ? (eventById.get(r.targetId) ?? null)
            : null,
        business:
          r.targetType === ReportTargetType.BUSINESS
            ? (businessById.get(r.targetId) ?? null)
            : null,
      };
    });
  }

  /** Super admin dashboard's platform-health numbers — see PlatformKpis'
   * own doc comment for why there's no revenue figure. */
  async getPlatformKpis(): Promise<PlatformKpis> {
    const newUserWindowStart = new Date();
    newUserWindowStart.setDate(
      newUserWindowStart.getDate() - NEW_USER_WINDOW_DAYS,
    );

    const [
      totalUsers,
      newUsersLast7Days,
      totalPlaces,
      totalBusinessListings,
      claimedBusinessCount,
      totalReviews,
      totalBookings,
      bookingCountsByStatusRaw,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo
        .createQueryBuilder("user")
        .where("user.createdAt >= :newUserWindowStart", {
          newUserWindowStart,
        })
        .getCount(),
      this.placeRepo.count(),
      this.businessRepo.count(),
      this.businessRepo
        .createQueryBuilder("business")
        .where("business.ownerUserId IS NOT NULL")
        .getCount(),
      this.reviewRepo.count(),
      this.bookingRepo.count(),
      this.bookingRepo
        .createQueryBuilder("booking")
        .select("booking.status", "status")
        .addSelect("COUNT(*)", "count")
        .groupBy("booking.status")
        .getRawMany<{ status: BookingStatus; count: string }>(),
    ]);

    const bookingsByStatus: Record<BookingStatus, number> = {
      [BookingStatus.PENDING]: 0,
      [BookingStatus.CONFIRMED]: 0,
      [BookingStatus.DECLINED]: 0,
      [BookingStatus.CANCELLED]: 0,
    };
    for (const row of bookingCountsByStatusRaw) {
      bookingsByStatus[row.status] = parseInt(row.count, 10);
    }

    return {
      totalUsers,
      newUsersLast7Days,
      totalPlaces,
      totalBusinessListings,
      claimedBusinessCount,
      businessClaimRate:
        totalPlaces > 0 ? claimedBusinessCount / totalPlaces : 0,
      totalReviews,
      totalBookings,
      bookingsByStatus,
    };
  }
}
