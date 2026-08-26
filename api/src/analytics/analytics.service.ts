import {
  BadRequestException,
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
import { Creator } from "../creators/entities/creator.entity";
import { Advertisement } from "../advertisements/entities/advertisement.entity";
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
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(Advertisement)
    private readonly advertisementRepo: Repository<Advertisement>,
  ) {}

  async record(dto: CreateAnalyticsEventDto): Promise<void> {
    const targetCount = [
      dto.placeId,
      dto.creatorId,
      dto.advertisementId,
    ].filter((id) => id !== undefined).length;
    if (targetCount !== 1) {
      throw new BadRequestException(
        "Provide exactly one of placeId, creatorId, or advertisementId",
      );
    }

    if (dto.placeId) {
      const exists = await this.placeRepo.exists({
        where: { id: dto.placeId },
      });
      if (!exists) {
        throw new NotFoundException(`Place "${dto.placeId}" not found`);
      }
      await this.eventRepo.save(
        this.eventRepo.create({
          placeId: dto.placeId,
          eventType: dto.eventType,
        }),
      );
      return;
    }

    if (dto.creatorId) {
      const creatorExists = await this.creatorRepo.exists({
        where: { id: dto.creatorId },
      });
      if (!creatorExists) {
        throw new NotFoundException(`Creator "${dto.creatorId}" not found`);
      }
      await this.eventRepo.save(
        this.eventRepo.create({
          creatorId: dto.creatorId,
          eventType: dto.eventType,
        }),
      );
      return;
    }

    const adExists = await this.advertisementRepo.exists({
      where: { id: dto.advertisementId },
    });
    if (!adExists) {
      throw new NotFoundException(
        `Advertisement "${dto.advertisementId}" not found`,
      );
    }
    await this.eventRepo.save(
      this.eventRepo.create({
        advertisementId: dto.advertisementId,
        eventType: dto.eventType,
      }),
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

    return this.aggregate("event.placeId = :id", business.linkedPlaceId);
  }

  /** Same shape as getBusinessAnalytics, for the creator's own profile
   * directly (no "linked place" indirection — a Creator is its own
   * analytics target, see AnalyticsEvent's doc comment). */
  async getCreatorAnalytics(
    userId: string,
    creatorId: string,
  ): Promise<BusinessAnalytics> {
    const creator = await this.creatorRepo.findOne({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException(`Creator "${creatorId}" not found`);
    }
    if (creator.userId !== userId) {
      throw new ForbiddenException(
        "Only the creator can view their own analytics",
      );
    }

    return this.aggregate("event.creatorId = :id", creatorId);
  }

  /** Same shape as getBusinessAnalytics/getCreatorAnalytics — "important
   * metrics of their advertisement" (views, contact clicks) for the ad's
   * own owner. */
  async getAdvertisementAnalytics(
    userId: string,
    advertisementId: string,
  ): Promise<BusinessAnalytics> {
    const ad = await this.advertisementRepo.findOne({
      where: { id: advertisementId },
    });
    if (!ad) {
      throw new NotFoundException(
        `Advertisement "${advertisementId}" not found`,
      );
    }
    if (ad.ownerUserId !== userId) {
      throw new ForbiddenException(
        "Only the advertisement's owner can view its analytics",
      );
    }

    return this.aggregate("event.advertisementId = :id", advertisementId);
  }

  private async aggregate(
    whereClause: string,
    id: string,
  ): Promise<BusinessAnalytics> {
    const totalsRaw = await this.eventRepo
      .createQueryBuilder("event")
      .select("event.eventType", "eventType")
      .addSelect("COUNT(*)", "count")
      .where(whereClause, { id })
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
      .where(whereClause, { id })
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
