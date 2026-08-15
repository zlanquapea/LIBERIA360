import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnalyticsEvent } from "./entities/analytics-event.entity";
import { AnalyticsEventType } from "./entities/analytics-event.enums";
import { Place } from "../places/entities/place.entity";
import { Business } from "../businesses/entities/business.entity";
import { CreateAnalyticsEventDto } from "./dto/create-analytics-event.dto";

const BUSINESS_ANALYTICS_WINDOW_DAYS = 30;

export interface AnalyticsTotals {
  view: number;
  save: number;
  contact_click: number;
  booking_request: number;
}

export interface BusinessAnalytics {
  totals: AnalyticsTotals;
  byDay: (AnalyticsTotals & { date: string })[];
}

function emptyTotals(): AnalyticsTotals {
  return { view: 0, save: 0, contact_click: 0, booking_request: 0 };
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(AnalyticsEvent)
    private readonly eventRepo: Repository<AnalyticsEvent>,
    @InjectRepository(Place)
    private readonly placeRepo: Repository<Place>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
  ) {}

  async record(dto: CreateAnalyticsEventDto): Promise<void> {
    const exists = await this.placeRepo.exists({ where: { id: dto.placeId } });
    if (!exists) {
      throw new NotFoundException(`Place "${dto.placeId}" not found`);
    }
    await this.eventRepo.save(
      this.eventRepo.create({ placeId: dto.placeId, eventType: dto.eventType }),
    );
  }

  /** Owner-only view of a single business's linked place: totals plus a
   * daily breakdown over the last 30 days (Tech Spec §3.3 business
   * analytics dashboard — "views, saves, contact clicks, conversion"). */
  async getBusinessAnalytics(
    userId: string,
    businessId: string,
  ): Promise<BusinessAnalytics> {
    const business = await this.businessRepo.findOne({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException(`Business "${businessId}" not found`);
    }
    if (business.ownerUserId !== userId) {
      throw new ForbiddenException(
        "Only the business owner can view its analytics",
      );
    }

    const placeId = business.linkedPlaceId;

    const totalsRaw = await this.eventRepo
      .createQueryBuilder("event")
      .select("event.eventType", "eventType")
      .addSelect("COUNT(*)", "count")
      .where("event.placeId = :placeId", { placeId })
      .groupBy("event.eventType")
      .getRawMany<{ eventType: AnalyticsEventType; count: string }>();

    const totals = emptyTotals();
    for (const row of totalsRaw) {
      totals[row.eventType] = parseInt(row.count, 10);
    }

    const since = new Date();
    since.setDate(since.getDate() - BUSINESS_ANALYTICS_WINDOW_DAYS);

    const byDayRaw = await this.eventRepo
      .createQueryBuilder("event")
      .select("DATE(event.createdAt)", "date")
      .addSelect("event.eventType", "eventType")
      .addSelect("COUNT(*)", "count")
      .where("event.placeId = :placeId", { placeId })
      .andWhere("event.createdAt >= :since", { since })
      .groupBy("DATE(event.createdAt)")
      .addGroupBy("event.eventType")
      .orderBy("DATE(event.createdAt)", "ASC")
      .getRawMany<{
        date: string;
        eventType: AnalyticsEventType;
        count: string;
      }>();

    const byDayMap = new Map<string, AnalyticsTotals & { date: string }>();
    for (const row of byDayRaw) {
      const dateKey = new Date(row.date).toISOString().slice(0, 10);
      if (!byDayMap.has(dateKey)) {
        byDayMap.set(dateKey, { date: dateKey, ...emptyTotals() });
      }
      byDayMap.get(dateKey)![row.eventType] = parseInt(row.count, 10);
    }

    return {
      totals,
      byDay: [...byDayMap.values()].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    };
  }
}
