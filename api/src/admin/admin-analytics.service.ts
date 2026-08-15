import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnalyticsEvent } from "../analytics/entities/analytics-event.entity";

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
}
