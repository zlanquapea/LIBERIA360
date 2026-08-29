import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { BusinessReviewStatus } from "../businesses/entities/business.enums";
import { BusinessContent } from "../business-content/entities/business-content.entity";
import { BusinessContentStatus } from "../business-content/entities/business-content.enums";
import { Creator } from "../creators/entities/creator.entity";
import { CreatorVerificationStatus } from "../creators/entities/creator.enums";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { EventReviewStatus } from "../events/entities/event.enums";
import { EventsService } from "../events/events.service";
import { User } from "../users/entities/user.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { BookingStatus } from "../bookings/entities/booking.enums";
import {
  PlaceReviewStatus,
  VerificationStatus,
} from "../places/entities/place.enums";
import { PlaceFreshnessReport } from "../freshness/entities/place-freshness-report.entity";
import { FreshnessResponse } from "../freshness/entities/place-freshness-report.enums";
import { ContentReport } from "../reports/entities/content-report.entity";
import {
  ReportReason,
  ReportTargetType,
} from "../reports/entities/content-report.enums";
import { AdminAuditService } from "./admin-audit.service";
import { RequestInfo } from "../common/request-info";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { Advertisement } from "../advertisements/entities/advertisement.entity";
import { AdvertisementReviewStatus } from "../advertisements/entities/advertisement.enums";
import { CarListing } from "../car-listings/entities/car-listing.entity";
import { CarListingReviewStatus } from "../car-listings/entities/car-listing.enums";

const NEW_USER_WINDOW_DAYS = 7;

const MODERATION_QUEUE_REVIEW_LIMIT = 20;

/** The three review-status transitions that represent an actual decision on
 * a submission, worth notifying the submitter about — UNDER_REVIEW/DRAFT/
 * SUBMITTED_FOR_REVIEW are "still pending", not a decision, so they're
 * deliberately excluded here. */
const DECISION_STATUSES = new Set([
  PlaceReviewStatus.APPROVED,
  PlaceReviewStatus.REJECTED,
  PlaceReviewStatus.SUSPENDED,
]);

function isReviewDecision(
  status:
    | PlaceReviewStatus
    | BusinessReviewStatus
    | AdvertisementReviewStatus
    | CarListingReviewStatus,
): boolean {
  return (DECISION_STATUSES as Set<string>).has(status);
}

// The freshness/report flag thresholds and windows used to be hardcoded
// constants here — "how many independent 'no longer here'/content
// reports in how many days before it surfaces in the moderation queue."
// They're now Settings > Application, read fresh on every call via
// SettingsService so a super admin can tune them without a deploy; see
// ApplicationSettings's doc comment for the current defaults (which
// match what these constants used to be, so a fresh deploy behaves
// identically until someone changes something).

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
  pendingPlaces: Place[];
  recentReviews: Review[];
  possiblyClosedPlaces: PossiblyClosedPlace[];
  flaggedContent: FlaggedContent[];
  pendingBusinessContent: BusinessContent[];
  pendingAdvertisements: Advertisement[];
  pendingEvents: Event[];
  pendingCarListings: CarListing[];
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
    @InjectRepository(BusinessContent)
    private readonly businessContentRepo: Repository<BusinessContent>,
    @InjectRepository(Advertisement)
    private readonly advertisementRepo: Repository<Advertisement>,
    @InjectRepository(CarListing)
    private readonly carListingRepo: Repository<CarListing>,
    private readonly adminAuditService: AdminAuditService,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly eventsService: EventsService,
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
    if (saved.ownerUserId && isReviewDecision(status)) {
      await this.notificationsService.create(saved.ownerUserId, {
        type: "business.review_decided",
        title: `Your listing was ${status}`,
        body: reason
          ? `"${saved.name}" was ${status}: ${reason}`
          : `"${saved.name}" was ${status}.`,
        // linkedPlace is `eager: true` on Business, so it's already
        // populated on `saved` — the owner manages their listing from its
        // place page (BusinessClaimSection), there's no separate business
        // management route.
        link: saved.linkedPlace
          ? `/places/${saved.linkedPlace.slug}`
          : undefined,
      });
    }
    return this.businessRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** The publish/moderation lifecycle transition for a self-submitted
   * place — mirrors setBusinessReviewStatus exactly; see
   * PlaceReviewStatus's doc comment for what each status means. */
  async setPlaceReviewStatus(
    adminUserId: string,
    placeId: string,
    status: PlaceReviewStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ): Promise<Place> {
    const place = await this.placeRepo.findOne({ where: { id: placeId } });
    if (!place) {
      throw new NotFoundException(`Place "${placeId}" not found`);
    }
    const previousStatus = place.reviewStatus;
    place.reviewStatus = status;
    place.rejectionReason =
      status === PlaceReviewStatus.APPROVED ? null : (reason ?? null);
    place.reviewedByUserId = adminUserId;
    place.reviewedAt = new Date();
    const saved = await this.placeRepo.save(place);
    await this.adminAuditService.log(
      adminUserId,
      "place.review_status_changed",
      "place",
      placeId,
      { from: previousStatus, to: status, reason: reason ?? null },
      requestInfo,
    );
    if (saved.ownerUserId && isReviewDecision(status)) {
      await this.notificationsService.create(saved.ownerUserId, {
        type: "place.review_decided",
        title: `Your submission was ${status}`,
        body: reason
          ? `"${saved.name}" was ${status}: ${reason}`
          : `"${saved.name}" was ${status}.`,
        link: "/account/my-places",
      });
    }
    return this.placeRepo.findOneOrFail({
      where: { id: saved.id },
      relations: ["category", "county", "owner"],
    });
  }

  /** Approve/reject one business-authored content item — mirrors
   * setBusinessReviewStatus's shape exactly, one level down (a single
   * post, not the whole listing). */
  async setBusinessContentReviewStatus(
    adminUserId: string,
    contentId: string,
    status: BusinessContentStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ): Promise<BusinessContent> {
    const content = await this.businessContentRepo.findOne({
      where: { id: contentId },
    });
    if (!content) {
      throw new NotFoundException(`Business content "${contentId}" not found`);
    }
    const previousStatus = content.status;
    content.status = status;
    content.rejectionReason =
      status === BusinessContentStatus.APPROVED ? null : (reason ?? null);
    content.reviewedByUserId = adminUserId;
    content.reviewedAt = new Date();
    const saved = await this.businessContentRepo.save(content);
    await this.adminAuditService.log(
      adminUserId,
      "business_content.review_status_changed",
      "business_content",
      contentId,
      { from: previousStatus, to: status, reason: reason ?? null },
      requestInfo,
    );
    return this.businessContentRepo.findOneOrFail({ where: { id: saved.id } });
  }

  /** Runs `action` once per id, sequentially (not Promise.all — a
   * moderation queue is exactly the kind of place a runaway concurrent
   * write storm against the DB would be bad, and sequential keeps each
   * item's audit-log entry in a sane order). One bad id in the batch
   * doesn't abort the rest: it's collected in `failed` so the caller can
   * report a partial result instead of an all-or-nothing failure. */
  private async runBulk<T>(
    ids: string[],
    action: (id: string) => Promise<T>,
  ): Promise<{ succeeded: string[]; failed: { id: string; error: string }[] }> {
    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of ids) {
      try {
        await action(id);
        succeeded.push(id);
      } catch (err) {
        failed.push({
          id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
    return { succeeded, failed };
  }

  /** Multi-select approve/reject from the moderation queue — same
   * transition as setPlaceReviewStatus, just for a batch. */
  bulkSetPlaceReviewStatus(
    adminUserId: string,
    ids: string[],
    status: PlaceReviewStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ) {
    return this.runBulk(ids, (id) =>
      this.setPlaceReviewStatus(adminUserId, id, status, reason, requestInfo),
    );
  }

  /** Bulk sibling of setBusinessReviewStatus — see bulkSetPlaceReviewStatus. */
  bulkSetBusinessReviewStatus(
    adminUserId: string,
    ids: string[],
    status: BusinessReviewStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ) {
    return this.runBulk(ids, (id) =>
      this.setBusinessReviewStatus(
        adminUserId,
        id,
        status,
        reason,
        requestInfo,
      ),
    );
  }

  /** Bulk sibling of setBusinessContentReviewStatus — see bulkSetPlaceReviewStatus. */
  bulkSetBusinessContentReviewStatus(
    adminUserId: string,
    ids: string[],
    status: BusinessContentStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ) {
    return this.runBulk(ids, (id) =>
      this.setBusinessContentReviewStatus(
        adminUserId,
        id,
        status,
        reason,
        requestInfo,
      ),
    );
  }

  /** Every business-authored content item awaiting a review decision,
   * across every business — the admin content-moderation list. */
  findPendingBusinessContent(): Promise<BusinessContent[]> {
    return this.businessContentRepo.find({
      where: { status: BusinessContentStatus.SUBMITTED_FOR_REVIEW },
      relations: ["business"],
      order: { submittedAt: "DESC" },
    });
  }

  findPendingAdvertisements(): Promise<Advertisement[]> {
    return this.advertisementRepo.find({
      where: { reviewStatus: AdvertisementReviewStatus.SUBMITTED_FOR_REVIEW },
      order: { submittedAt: "DESC" },
    });
  }

  /** Every advertisement regardless of status — an admin's own management
   * view, so an already-APPROVED ad can still be found and suspended. */
  findAllAdvertisements(): Promise<Advertisement[]> {
    return this.advertisementRepo.find({ order: { createdAt: "DESC" } });
  }

  /** The publish/moderation lifecycle transition for a self-submitted
   * advertisement — mirrors setPlaceReviewStatus/setBusinessReviewStatus
   * exactly; see AdvertisementReviewStatus's doc comment for what each
   * status means. */
  async setAdvertisementReviewStatus(
    adminUserId: string,
    id: string,
    status: AdvertisementReviewStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ): Promise<Advertisement> {
    const ad = await this.advertisementRepo.findOne({ where: { id } });
    if (!ad) {
      throw new NotFoundException(`Advertisement "${id}" not found`);
    }
    const previousStatus = ad.reviewStatus;
    ad.reviewStatus = status;
    ad.rejectionReason =
      status === AdvertisementReviewStatus.APPROVED ? null : (reason ?? null);
    ad.reviewedByUserId = adminUserId;
    ad.reviewedAt = new Date();
    const saved = await this.advertisementRepo.save(ad);
    await this.adminAuditService.log(
      adminUserId,
      "advertisement.review_status_changed",
      "advertisement",
      id,
      { from: previousStatus, to: status, reason: reason ?? null },
      requestInfo,
    );
    if (isReviewDecision(status)) {
      await this.notificationsService.create(saved.ownerUserId, {
        type: "advertisement.review_decided",
        title: `Your advertisement was ${status}`,
        body: reason
          ? `"${saved.title}" was ${status}: ${reason}`
          : `"${saved.title}" was ${status}.`,
        link: "/account/my-ads",
      });
    }
    return this.advertisementRepo.findOneOrFail({ where: { id } });
  }

  findPendingCarListings(): Promise<CarListing[]> {
    return this.carListingRepo.find({
      where: { reviewStatus: CarListingReviewStatus.SUBMITTED_FOR_REVIEW },
      order: { submittedAt: "DESC" },
    });
  }

  /** Every car listing regardless of status — an admin's own management
   * view, so an already-APPROVED listing can still be found and
   * suspended. */
  findAllCarListings(): Promise<CarListing[]> {
    return this.carListingRepo.find({ order: { createdAt: "DESC" } });
  }

  /** The publish/moderation lifecycle transition for a self-listed
   * vehicle — mirrors setAdvertisementReviewStatus exactly; see
   * CarListingReviewStatus's doc comment for what each status means. */
  async setCarListingReviewStatus(
    adminUserId: string,
    id: string,
    status: CarListingReviewStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ): Promise<CarListing> {
    const listing = await this.carListingRepo.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Car listing "${id}" not found`);
    }
    const previousStatus = listing.reviewStatus;
    listing.reviewStatus = status;
    listing.rejectionReason =
      status === CarListingReviewStatus.APPROVED ? null : (reason ?? null);
    listing.reviewedByUserId = adminUserId;
    listing.reviewedAt = new Date();
    const saved = await this.carListingRepo.save(listing);
    await this.adminAuditService.log(
      adminUserId,
      "car_listing.review_status_changed",
      "car_listing",
      id,
      { from: previousStatus, to: status, reason: reason ?? null },
      requestInfo,
    );
    if (isReviewDecision(status)) {
      await this.notificationsService.create(saved.ownerUserId, {
        type: "car_listing.review_decided",
        title: `Your car listing was ${status}`,
        body: reason
          ? `"${saved.title}" was ${status}: ${reason}`
          : `"${saved.title}" was ${status}.`,
        link: "/account/my-car-listings",
      });
    }
    return this.carListingRepo.findOneOrFail({ where: { id } });
  }

  findPendingEvents(): Promise<Event[]> {
    return this.eventRepo.find({
      where: { reviewStatus: EventReviewStatus.PENDING },
      order: { createdAt: "DESC" },
    });
  }

  /** Every event regardless of status — the admin events management
   * table's own list, unlike the public GET /events (approved-only). */
  findAllEvents(): Promise<Event[]> {
    return this.eventRepo.find({ order: { createdAt: "DESC" } });
  }

  /** The publish/moderation decision on a self-submitted event — approve
   * or reject, mirrors setAdvertisementReviewStatus. Approving fires the
   * "events nearby" push (EventsService.notifyNearby) that create()
   * skipped for a PENDING submission, so nearby residents only ever hear
   * about an event once it's actually live. */
  async setEventReviewStatus(
    adminUserId: string,
    id: string,
    status: EventReviewStatus,
    reason?: string,
    requestInfo?: RequestInfo,
  ): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event "${id}" not found`);
    }
    const previousStatus = event.reviewStatus;
    event.reviewStatus = status;
    event.rejectionReason =
      status === EventReviewStatus.APPROVED ? null : (reason ?? null);
    event.reviewedByUserId = adminUserId;
    event.reviewedAt = new Date();
    const saved = await this.eventRepo.save(event);
    await this.adminAuditService.log(
      adminUserId,
      "event.review_status_changed",
      "event",
      id,
      { from: previousStatus, to: status, reason: reason ?? null },
      requestInfo,
    );
    if (status === EventReviewStatus.APPROVED) {
      const full = await this.eventRepo.findOneOrFail({ where: { id } });
      await this.eventsService.notifyNearby(full);
    }
    await this.notificationsService.create(saved.createdByUserId, {
      type: "event.review_decided",
      title: `Your event was ${status}`,
      body: reason
        ? `"${saved.name}" was ${status}: ${reason}`
        : `"${saved.name}" was ${status}.`,
      link: "/account/my-events",
    });
    return this.eventRepo.findOneOrFail({ where: { id } });
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
   * see that entity's doc comment).
   *
   * Also surfaces self-submitted places awaiting a decision
   * (`pendingPlaces`). Without this, a place submitted through the public
   * form sits in SUBMITTED_FOR_REVIEW indefinitely and is invisible
   * everywhere — not just to the public (deliberate, see
   * PlacesService.findAll), but to admins too, since the only way to find
   * it was manually filtering Content > Places to the "Pending review"
   * chip. That silence is exactly what made testers who self-submitted
   * places think Near Me was broken: their places were never rejected,
   * just never looked at. */
  async getModerationQueue(): Promise<ModerationQueue> {
    const settings = await this.settingsService.getApplicationSettings();
    const [
      pendingBusinesses,
      pendingPlaces,
      recentReviews,
      possiblyClosedPlaces,
      flaggedContent,
      pendingBusinessContent,
      pendingAdvertisements,
      pendingEvents,
      pendingCarListings,
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
      this.placeRepo.find({
        where: [
          { reviewStatus: PlaceReviewStatus.SUBMITTED_FOR_REVIEW },
          { reviewStatus: PlaceReviewStatus.UNDER_REVIEW },
        ],
        relations: ["category", "county", "owner"],
        order: { submittedAt: "DESC" },
      }),
      this.reviewRepo.find({
        relations: ["user", "place"],
        order: { createdAt: "DESC" },
        take: MODERATION_QUEUE_REVIEW_LIMIT,
      }),
      this.findPossiblyClosedPlaces(
        settings.freshnessFlagThreshold,
        settings.freshnessWindowDays,
      ),
      this.findFlaggedContent(
        settings.reportFlagThreshold,
        settings.reportWindowDays,
      ),
      this.findPendingBusinessContent(),
      this.findPendingAdvertisements(),
      this.findPendingEvents(),
      this.findPendingCarListings(),
    ]);
    return {
      pendingBusinessContent,
      pendingBusinesses,
      pendingPlaces,
      recentReviews,
      possiblyClosedPlaces,
      flaggedContent,
      pendingAdvertisements,
      pendingEvents,
      pendingCarListings,
    };
  }

  private async findPossiblyClosedPlaces(
    threshold: number,
    windowDays: number,
  ): Promise<PossiblyClosedPlace[]> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const rows = await this.freshnessReportRepo
      .createQueryBuilder("report")
      .select("report.placeId", "placeId")
      .addSelect("COUNT(*)", "count")
      .where("report.response = :response", {
        response: FreshnessResponse.NO_LONGER_HERE,
      })
      .andWhere("report.createdAt >= :windowStart", { windowStart })
      .groupBy("report.placeId")
      .having("COUNT(*) >= :threshold", { threshold })
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

  private async findFlaggedContent(
    threshold: number,
    windowDays: number,
  ): Promise<FlaggedContent[]> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - windowDays);

    const rows = await this.contentReportRepo
      .createQueryBuilder("report")
      .select("report.targetType", "targetType")
      .addSelect("report.targetId", "targetId")
      .addSelect("COUNT(*)", "count")
      .where("report.createdAt >= :windowStart", { windowStart })
      .groupBy("report.targetType")
      .addGroupBy("report.targetId")
      .having("COUNT(*) >= :threshold", { threshold })
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
