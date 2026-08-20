import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnalyticsEvent } from "../analytics/entities/analytics-event.entity";
import { User } from "../users/entities/user.entity";
import { Review } from "../reviews/entities/review.entity";
import { Booking } from "../bookings/entities/booking.entity";
import { Place } from "../places/entities/place.entity";
import { buildInsights, buildTrend } from "./admin-analytics-insights";

export interface TopPlace {
  placeId: string;
  name: string;
  slug: string;
  views: number;
  saves: number;
  contactClicks: number;
  bookingRequests: number;
  total: number;
}

export interface InterestBreakdown {
  id: string;
  name: string;
  totalEvents: number;
}

export interface AggregateAnalytics {
  topPlaces: TopPlace[];
  byCategory: InterestBreakdown[];
  byCounty: InterestBreakdown[];
}

export interface MetricTrend {
  key: "newUsers" | "newReviews" | "newBookings" | "pageViews";
  label: string;
  current: number;
  previous: number;
  // null rather than a fake number when there's nothing to compare against
  // (previous period was 0) — a "+∞%" or a silently-clamped number would
  // both misrepresent what actually happened.
  deltaPct: number | null;
  direction: "up" | "down" | "flat";
}

export interface NeglectedPlace {
  placeId: string;
  name: string;
  slug: string;
}

export interface TopReviewer {
  userId: string;
  name: string;
  reviewCount: number;
}

export interface AnalyticsOverview {
  periodDays: number;
  metrics: MetricTrend[];
  topPlaces: TopPlace[];
  // Catalog places with zero recorded analytics events in the period —
  // "getting no attention," the useful opposite of topPlaces for an admin
  // deciding where to focus (feature it, check the listing quality, etc.).
  neglectedPlaces: NeglectedPlace[];
  topReviewers: TopReviewer[];
  // Deterministic, rule-based sentences generated from the metrics above
  // (see buildInsights) — not a summarization model, just thresholds on
  // numbers already computed in this same request.
  insights: string[];
}

/** B2B tourism analytics product (Business Plan §8.4) — "aggregate,
 * anonymized insight into search trends and visitor interest ... offered
 * to hotels, tour operators, investors, government, and NGOs." Built on
 * the same AnalyticsEvent log as the per-business dashboard (analytics
 * module), but rolled up across the whole catalog with no per-visitor
 * data in the output. Exposed through the admin dashboard rather than a
 * separate external-stakeholder account system — the spec doesn't say who
 * those accounts would be or how they'd authenticate, so building that is
 * a bigger, separate product decision this one-paragraph mention doesn't
 * give enough to design against. */
@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
  ) {}

  async getAggregate(limit = 10): Promise<AggregateAnalytics> {
    const topPlacesRaw = await this.eventRepo
      .createQueryBuilder("event")
      .innerJoin("event.place", "place")
      .select("place.id", "placeId")
      .addSelect("place.name", "name")
      .addSelect("place.slug", "slug")
      .addSelect("COUNT(*) FILTER (WHERE event.eventType = 'view')", "views")
      .addSelect("COUNT(*) FILTER (WHERE event.eventType = 'save')", "saves")
      .addSelect(
        "COUNT(*) FILTER (WHERE event.eventType = 'contact_click')",
        "contactClicks",
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE event.eventType = 'booking_request')",
        "bookingRequests",
      )
      .addSelect("COUNT(*)", "total")
      .groupBy("place.id")
      .addGroupBy("place.name")
      .addGroupBy("place.slug")
      .orderBy("total", "DESC")
      .limit(limit)
      .getRawMany<{
        placeId: string;
        name: string;
        slug: string;
        views: string;
        saves: string;
        contactClicks: string;
        bookingRequests: string;
        total: string;
      }>();

    const byCategoryRaw = await this.eventRepo
      .createQueryBuilder("event")
      .innerJoin("event.place", "place")
      .innerJoin("place.category", "category")
      .select("category.id", "id")
      .addSelect("category.name", "name")
      .addSelect("COUNT(*)", "total_events")
      .groupBy("category.id")
      .addGroupBy("category.name")
      .orderBy("total_events", "DESC")
      .getRawMany<{ id: string; name: string; total_events: string }>();

    const byCountyRaw = await this.eventRepo
      .createQueryBuilder("event")
      .innerJoin("event.place", "place")
      .innerJoin("place.county", "county")
      .select("county.id", "id")
      .addSelect("county.name", "name")
      .addSelect("COUNT(*)", "total_events")
      .groupBy("county.id")
      .addGroupBy("county.name")
      .orderBy("total_events", "DESC")
      .getRawMany<{ id: string; name: string; total_events: string }>();

    return {
      topPlaces: topPlacesRaw.map((row) => ({
        placeId: row.placeId,
        name: row.name,
        slug: row.slug,
        views: parseInt(row.views, 10),
        saves: parseInt(row.saves, 10),
        contactClicks: parseInt(row.contactClicks, 10),
        bookingRequests: parseInt(row.bookingRequests, 10),
        total: parseInt(row.total, 10),
      })),
      byCategory: byCategoryRaw.map((row) => ({
        id: row.id,
        name: row.name,
        totalEvents: parseInt(row.total_events, 10),
      })),
      byCounty: byCountyRaw.map((row) => ({
        id: row.id,
        name: row.name,
        totalEvents: parseInt(row.total_events, 10),
      })),
    };
  }

  /** "Analytics should drive decisions" — the current-vs-previous-period
   * comparison this needs doesn't require a metrics warehouse: every
   * table already has createdAt, so two overlapping windowed COUNTs
   * against the real tables gives a genuine week-over-week comparison,
   * computed on request rather than from stored snapshots. */
  async getOverview(periodDays = 7): Promise<AnalyticsOverview> {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - periodDays);
    const previousStart = new Date(currentStart);
    previousStart.setDate(previousStart.getDate() - periodDays);

    const [
      newUsersCurrent,
      newUsersPrevious,
      newReviewsCurrent,
      newReviewsPrevious,
      newBookingsCurrent,
      newBookingsPrevious,
      pageViewsCurrent,
      pageViewsPrevious,
      aggregate,
      neglectedPlacesRaw,
      topReviewersRaw,
    ] = await Promise.all([
      this.userRepo
        .createQueryBuilder("user")
        .where("user.createdAt >= :currentStart", { currentStart })
        .getCount(),
      this.userRepo
        .createQueryBuilder("user")
        .where("user.createdAt >= :previousStart", { previousStart })
        .andWhere("user.createdAt < :currentStart", { currentStart })
        .getCount(),
      this.reviewRepo
        .createQueryBuilder("review")
        .where("review.createdAt >= :currentStart", { currentStart })
        .getCount(),
      this.reviewRepo
        .createQueryBuilder("review")
        .where("review.createdAt >= :previousStart", { previousStart })
        .andWhere("review.createdAt < :currentStart", { currentStart })
        .getCount(),
      this.bookingRepo
        .createQueryBuilder("booking")
        .where("booking.createdAt >= :currentStart", { currentStart })
        .getCount(),
      this.bookingRepo
        .createQueryBuilder("booking")
        .where("booking.createdAt >= :previousStart", { previousStart })
        .andWhere("booking.createdAt < :currentStart", { currentStart })
        .getCount(),
      this.eventRepo
        .createQueryBuilder("event")
        .where("event.eventType = 'view'")
        .andWhere("event.createdAt >= :currentStart", { currentStart })
        .getCount(),
      this.eventRepo
        .createQueryBuilder("event")
        .where("event.eventType = 'view'")
        .andWhere("event.createdAt >= :previousStart", { previousStart })
        .andWhere("event.createdAt < :currentStart", { currentStart })
        .getCount(),
      this.getAggregate(5),
      this.placeRepo
        .createQueryBuilder("place")
        .where(
          `place.id NOT IN (
            SELECT DISTINCT event.place_id FROM analytics_events event
            WHERE event.created_at >= :currentStart
          )`,
          { currentStart },
        )
        .orderBy("place.createdAt", "ASC")
        .limit(5)
        .getMany(),
      this.reviewRepo
        .createQueryBuilder("review")
        .innerJoin("review.user", "user")
        .select("user.id", "userId")
        .addSelect("user.name", "name")
        .addSelect("COUNT(*)", "reviewCount")
        .where("review.createdAt >= :currentStart", { currentStart })
        .groupBy("user.id")
        .addGroupBy("user.name")
        // Quoted: the "reviewCount" alias is mixed-case, and Postgres
        // folds an unquoted identifier to lowercase — an unquoted
        // `review_count` here doesn't match the `AS "reviewCount"` alias
        // TypeORM actually generated, which 500'd every request until this
        // was caught by running the endpoint for real (mocked-repo unit
        // tests never execute real SQL, so this couldn't have failed one).
        .orderBy('"reviewCount"', "DESC")
        .limit(5)
        .getRawMany<{ userId: string; name: string; reviewCount: string }>(),
    ]);

    const metrics: MetricTrend[] = [
      buildTrend("newUsers", "New sign-ups", newUsersCurrent, newUsersPrevious),
      buildTrend(
        "newReviews",
        "New reviews",
        newReviewsCurrent,
        newReviewsPrevious,
      ),
      buildTrend(
        "newBookings",
        "New booking requests",
        newBookingsCurrent,
        newBookingsPrevious,
      ),
      buildTrend(
        "pageViews",
        "Place page views",
        pageViewsCurrent,
        pageViewsPrevious,
      ),
    ];

    return {
      periodDays,
      metrics,
      topPlaces: aggregate.topPlaces,
      neglectedPlaces: neglectedPlacesRaw.map((place) => ({
        placeId: place.id,
        name: place.name,
        slug: place.slug,
      })),
      topReviewers: topReviewersRaw.map((row) => ({
        userId: row.userId,
        name: row.name,
        reviewCount: parseInt(row.reviewCount, 10),
      })),
      insights: buildInsights(
        metrics,
        aggregate.topPlaces,
        neglectedPlacesRaw.length,
      ),
    };
  }
}
