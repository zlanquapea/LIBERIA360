import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Event } from "./entities/event.entity";
import { EventRsvp } from "./entities/event-rsvp.entity";
import { EventReviewStatus, EventRsvpStatus } from "./entities/event.enums";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { QueryEventsDto } from "./dto/query-events.dto";
import { clearStaleRelation } from "../common/typeorm-relations";
import { PushService } from "../push/push.service";
import { UsersService } from "../users/users.service";
import { BusinessesService } from "../businesses/businesses.service";
import { CreatorsService } from "../creators/creators.service";
import { NotificationsService } from "../notifications/notifications.service";
import { User } from "../users/entities/user.entity";

// Where an admin goes to act on a pending event — same moderation queue
// page as pending places/businesses/advertisements, not a route of its
// own — mirrors AdvertisementsService's AD_MODERATION_QUEUE_LINK.
const EVENT_MODERATION_QUEUE_LINK = "/admin/content/moderation";

export interface PaginatedEvents {
  data: Event[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventRsvp)
    private readonly rsvpRepo: Repository<EventRsvp>,
    private readonly pushService: PushService,
    private readonly usersService: UsersService,
    private readonly businessesService: BusinessesService,
    private readonly creatorsService: CreatorsService,
    private readonly notificationsService: NotificationsService,
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

    // Admin-created events skip the review gate — an admin reviewing
    // their own submission would be reviewing nothing, same reasoning as
    // AdminContentService.createPlace bypassing PlaceReviewStatus. Every
    // other organizer (a claimed business or creator — see
    // assertCanPostEvents) starts PENDING; the event isn't publicly
    // reachable until an admin approves it (see EventsService.findAll).
    const isAdminSubmission = user.isAdmin;
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
      reviewStatus: isAdminSubmission
        ? EventReviewStatus.APPROVED
        : EventReviewStatus.PENDING,
      reviewedAt: isAdminSubmission ? new Date() : null,
      reviewedByUserId: isAdminSubmission ? user.id : null,
    });
    const saved = await this.eventRepo.save(event);
    const full = await this.eventRepo.findOneOrFail({
      where: { id: saved.id },
    });

    if (isAdminSubmission) {
      // "Events nearby" push (Tech Spec §3.2) — targeted at users who've
      // set this event's county as their home county. Fire-and-forget: a
      // notification failure should never fail event creation. Only fires
      // once the event is actually live — for a self-service submission
      // that's on approval (see AdminService.setEventReviewStatus), not
      // here, so nearby residents aren't told about an event that might
      // still get rejected.
      void this.notifyNearby(full);
    } else {
      await this.notifyAdminsOfPendingEvent(full);
    }

    return full;
  }

  /** Broadcasts an in-app notification to every admin (see
   * UsersService.findAdminIds) when an event enters PENDING — mirrors
   * AdvertisementsService.notifyAdminsOfPendingAd. */
  private async notifyAdminsOfPendingEvent(event: Event): Promise<void> {
    const adminIds = await this.usersService.findAdminIds();
    await this.notificationsService.createMany(adminIds, {
      type: "admin.event_pending_review",
      title: "Event pending review",
      body: `"${event.name}" is waiting for a review decision.`,
      link: EVENT_MODERATION_QUEUE_LINK,
    });
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

  /** Fires once an event is actually live — from create() for an
   * admin-created event (auto-approved), or from
   * AdminService.setEventReviewStatus on approval for a self-service one.
   * Public (not private) so AdminService can call it too. */
  async notifyNearby(event: Event): Promise<void> {
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
      .leftJoinAndSelect("event.createdBy", "createdBy")
      // Public browsing only ever sees APPROVED events — a PENDING event
      // hasn't been reviewed yet and a REJECTED one failed review; neither
      // belongs in front of a visitor. The admin events table uses its own
      // GET /admin/events (unfiltered), not this endpoint.
      .where("event.reviewStatus = :approved", {
        approved: EventReviewStatus.APPROVED,
      });

    if (query.category) {
      qb.andWhere("event.category = :category", { category: query.category });
    }
    if (query.county) {
      qb.andWhere("county.slug = :countySlug", { countySlug: query.county });
    }
    if (query.dateFrom) {
      qb.andWhere("event.startDate >= :dateFrom", { dateFrom: query.dateFrom });
    } else if (!query.includePast) {
      // Public browsing (the /events page) never passes dateFrom or
      // includePast — without this, an event that already happened stays
      // in the results forever and, being the earliest startDate, sorts
      // to the very top ahead of everything actually upcoming. Admin's
      // events management table passes includePast so a past event is
      // still reachable to edit or remove.
      qb.andWhere("event.startDate >= :now", { now: new Date() });
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

  /** GET /events/:id — deliberately NOT filtered by reviewStatus, unlike
   * findAll/PlacesService.findBySlug/AdvertisementsService.findActiveOne:
   * an event isn't discoverable by anyone browsing (findAll already hides
   * anything not APPROVED), but the organizer's own "My Events" list
   * links straight to this route for their just-submitted, still-PENDING
   * event, and there's no separate "preview my pending event" page to
   * send them to instead. A stale link to a since-rejected event is an
   * acceptable trade for that page not 404ing on its own organizer. */
  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event "${id}" not found`);
    }
    return event;
  }

  /** Everything a user has posted, regardless of date — the "My Events"
   * account page, which needs past events too (so someone can see what
   * they've already run), unlike the public listing above. */
  async findMine(userId: string): Promise<Event[]> {
    return this.eventRepo.find({
      where: { createdByUserId: userId },
      order: { startDate: "ASC" },
    });
  }

  /** Self-service edit for the organizer who posted it (or an admin) —
   * previously the only way to fix a typo or a wrong date was asking an
   * admin to do it through the separate admin-only endpoint. Mirrors
   * AdminContentService.updateEvent's validation/merge logic exactly. */
  async update(user: User, id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.getOwned(user, id);

    const nextPlaceId = dto.placeId ?? event.placeId;
    const nextLocationText = dto.locationText ?? event.locationText;
    if (!nextPlaceId && !nextLocationText) {
      throw new BadRequestException(
        "Provide either placeId or locationText for the event location",
      );
    }
    const nextStart = dto.startDate ?? event.startDate.toISOString();
    const nextEnd = dto.endDate ?? event.endDate?.toISOString();
    if (nextEnd && new Date(nextEnd) < new Date(nextStart)) {
      throw new BadRequestException("endDate cannot be before startDate");
    }

    // `place`/`county` are both `eager: true` — see clearStaleRelation's
    // doc comment; without this, reassigning placeId/countyId silently
    // no-ops.
    if (dto.placeId) clearStaleRelation(event, "place");
    if (dto.countyId) clearStaleRelation(event, "county");

    this.eventRepo.merge(event, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });
    await this.eventRepo.save(event);
    return this.eventRepo.findOneOrFail({ where: { id } });
  }

  /** Self-service cancel/remove — same ownership rule as update. */
  async remove(user: User, id: string): Promise<void> {
    const event = await this.getOwned(user, id);
    await this.eventRepo.delete({ id: event.id });
  }

  private async getOwned(user: User, id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event "${id}" not found`);
    }
    if (event.createdByUserId === user.id || user.isAdmin) {
      return event;
    }
    throw new ForbiddenException("Only the event's organizer can do this");
  }

  private countField(
    status: EventRsvpStatus,
  ): "interestedCount" | "goingCount" {
    return status === EventRsvpStatus.INTERESTED
      ? "interestedCount"
      : "goingCount";
  }

  /** Marks the viewer Interested or Going — mutually exclusive, so setting
   * one while the other is active moves the count across rather than
   * accumulating both (see EventRsvpStatus's doc comment). Idempotent:
   * setting the status the viewer already has is a no-op rather than an
   * error, since the frontend's toggle button doesn't first check whether
   * a tap is a genuine change. */
  async setRsvp(
    userId: string,
    eventId: string,
    status: EventRsvpStatus,
  ): Promise<{
    status: EventRsvpStatus;
    interestedCount: number;
    goingCount: number;
  }> {
    const event = await this.findOne(eventId);
    const existing = await this.rsvpRepo.findOne({
      where: { eventId, userId },
    });

    if (existing?.status === status) {
      return {
        status,
        interestedCount: event.interestedCount,
        goingCount: event.goingCount,
      };
    }

    if (existing) {
      event[this.countField(existing.status)] = Math.max(
        0,
        event[this.countField(existing.status)] - 1,
      );
      existing.status = status;
      await this.rsvpRepo.save(existing);
    } else {
      await this.rsvpRepo.save(
        this.rsvpRepo.create({ eventId, userId, status }),
      );
    }
    event[this.countField(status)] += 1;
    await this.eventRepo.save(event);

    return {
      status,
      interestedCount: event.interestedCount,
      goingCount: event.goingCount,
    };
  }

  /** Clears the viewer's RSVP entirely — tapping an already-active
   * Interested/Going button again, Facebook-style, un-marks it rather than
   * switching to the other status. */
  async removeRsvp(
    userId: string,
    eventId: string,
  ): Promise<{ interestedCount: number; goingCount: number }> {
    const event = await this.findOne(eventId);
    const existing = await this.rsvpRepo.findOne({
      where: { eventId, userId },
    });
    if (!existing) {
      return {
        interestedCount: event.interestedCount,
        goingCount: event.goingCount,
      };
    }
    event[this.countField(existing.status)] = Math.max(
      0,
      event[this.countField(existing.status)] - 1,
    );
    await this.rsvpRepo.remove(existing);
    await this.eventRepo.save(event);
    return {
      interestedCount: event.interestedCount,
      goingCount: event.goingCount,
    };
  }

  /** The viewer's own RSVP status — fetched client-side on the event detail
   * page (see events.controller.ts) rather than embedded in the public
   * findOne/findAll responses, since those routes have no auth guard and
   * so no reliable viewer identity to embed it against (same simplification
   * CreatorFeedService's public discover feed already accepts for
   * viewerLiked/viewerSaved). */
  async getViewerRsvp(
    userId: string,
    eventId: string,
  ): Promise<EventRsvpStatus | null> {
    const existing = await this.rsvpRepo.findOne({
      where: { eventId, userId },
    });
    return existing?.status ?? null;
  }

  /** A handful of the people marked Going, for the event page's "X people
   * going" avatar strip — newest first, same as a real invite list reads
   * top-down. Public (no auth) since attendee names are no more sensitive
   * than a review author's name elsewhere on this platform. */
  async getGoingAttendees(
    eventId: string,
    limit = 6,
  ): Promise<Array<{ id: string; name: string }>> {
    const rows = await this.rsvpRepo.find({
      where: { eventId, status: EventRsvpStatus.GOING },
      relations: ["user"],
      order: { createdAt: "DESC" },
      take: limit,
    });
    return rows.map((row) => ({ id: row.user.id, name: row.user.name }));
  }
}
