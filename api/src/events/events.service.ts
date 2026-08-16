import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event } from "./entities/event.entity";
import { CreateEventDto } from "./dto/create-event.dto";
import { QueryEventsDto } from "./dto/query-events.dto";
import { PushService } from "../push/push.service";
import { UsersService } from "../users/users.service";
import { BusinessesService } from "../businesses/businesses.service";
import { CreatorsService } from "../creators/creators.service";
import { User } from "../users/entities/user.entity";

export interface PaginatedEvents {
  data: Event[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    private readonly pushService: PushService,
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly creatorsService: CreatorsService,
  ) {}

  async create(user: User, dto: CreateEventDto): Promise<Event> {
    await this.assertCanPostEvents(user);

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
      createdByUserId: user.id,
    });
    const saved = await this.eventRepo.save(event);
    const full = await this.eventRepo.findOneOrFail({
      where: { id: saved.id },
    });

    // "Events nearby" push (Tech Spec §3.2) — targeted at users who've set
    // this event's county as their home county. Fire-and-forget: a
    // notification failure should never fail event creation.
    void this.notifyNearby(full);

    return full;
  }

  // Posting was originally open to any logged-in user — cheap for
  // spam/junk listings with zero accountability behind them. Restricted to
  // identities that already carry some public accountability: a claimed
  // business, a creator profile, or admin. Deliberately reuses the existing
  // ownership-derived permission pattern (see BusinessesService/
  // CreatorsService.findMine) rather than adding a new stored "organizer"
  // role — a business owner or creator who stops being one loses posting
  // rights automatically, the same way they'd lose any other business/
  // creator capability, with nothing to separately revoke.
  private async assertCanPostEvents(user: User): Promise<void> {
    if (user.isAdmin) return;

    const [businesses, creator] = await Promise.all([
      this.businessesService.findMine(user.id),
      this.creatorsService.findMine(user.id),
    ]);
    if (businesses.length > 0 || creator) return;

    throw new ForbiddenException(
      "Posting events requires a claimed business listing or a creator profile — claim a business or set up a creator profile first.",
    );
  }

  private async notifyNearby(event: Event): Promise<void> {
    const userIds = await this.usersService.findIdsByHomeCounty(event.countyId);
    if (userIds.length === 0) return;
    await this.pushService.sendToUsers(
      userIds.filter((id) => id !== event.createdByUserId),
      {
        title: `New event in ${event.county.name}`,
        body: event.name,
        url: `/events/${event.id}`,
      },
    );
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
