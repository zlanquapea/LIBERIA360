import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event } from "./entities/event.entity";
import { CreateEventDto } from "./dto/create-event.dto";
import { QueryEventsDto } from "./dto/query-events.dto";

export interface PaginatedEvents {
  data: Event[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  async create(userId: string, dto: CreateEventDto): Promise<Event> {
    if (!dto.placeId && !dto.locationText) {
      throw new BadRequestException(
        "Provide either placeId or locationText for the event location",
      );
    }
    if (dto.endDate && new Date(dto.endDate) < new Date(dto.startDate)) {
      throw new BadRequestException("endDate cannot be before startDate");
    }

    const event = this.eventRepo.create({
      name: dto.name,
      category: dto.category,
      placeId: dto.placeId ?? null,
      locationText: dto.locationText ?? null,
      countyId: dto.countyId,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      description: dto.description ?? null,
      images: dto.images ?? [],
      ticketInfo: dto.ticketInfo ?? null,
      createdByUserId: userId,
    });
    const saved = await this.eventRepo.save(event);
    return this.eventRepo.findOneOrFail({ where: { id: saved.id } });
  }

  async findAll(query: QueryEventsDto): Promise<PaginatedEvents> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.eventRepo
      .createQueryBuilder("event")
      .leftJoinAndSelect("event.county", "county")
      .leftJoinAndSelect("event.place", "place")
      .leftJoinAndSelect("event.createdBy", "createdBy");

    if (query.category) {
      qb.andWhere("event.category = :category", { category: query.category });
    }
    if (query.county) {
      qb.andWhere("county.slug = :countySlug", { countySlug: query.county });
    }
    if (query.dateFrom) {
      qb.andWhere("event.startDate >= :dateFrom", { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere("event.startDate <= :dateTo", { dateTo: query.dateTo });
    }

    qb.orderBy("event.startDate", "ASC")
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event "${id}" not found`);
    }
    return event;
  }
}
