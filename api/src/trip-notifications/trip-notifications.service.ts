import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Between, IsNull, Repository } from "typeorm";
import { Itinerary } from "../itineraries/entities/itinerary.entity";
import { ItineraryCollaborator } from "../itineraries/entities/itinerary-collaborator.entity";
import { User } from "../users/entities/user.entity";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { TripNotificationDelivery } from "./entities/trip-notification-delivery.entity";
import { AppConfig } from "../config/configuration";

/** How long before departure each reminder fires, and the label used in
 * its copy — product ask (Sep 2026): "3 days, 1 day, 6 hours and 1 hour
 * to the trip... to organizers and participants." Ordered longest-first
 * only for readability; remindersFor below checks every entry regardless
 * of order. */
const REMINDER_TARGETS: Array<{
  kind: string;
  offsetMs: number;
  label: string;
}> = [
  { kind: "reminder_3d", offsetMs: 259_200_000, label: "3 days" },
  { kind: "reminder_1d", offsetMs: 86_400_000, label: "1 day" },
  { kind: "reminder_6h", offsetMs: 21_600_000, label: "6 hours" },
  { kind: "reminder_1h", offsetMs: 3_600_000, label: "1 hour" },
];
const LOOKAHEAD_MS = Math.max(...REMINDER_TARGETS.map((t) => t.offsetMs));

/** Departure reminders for a saved trip (Sep 2026 product ask), mirroring
 * EventNotificationsService's minute-tick delivery-table pattern: the
 * organizer (Itinerary.userId) and every collaborator (participant) get
 * the same in-app notification + email at each of the four windows
 * before Itinerary.startDate. A trip with no startDate (most
 * AI-generated ones, and every trip made before the Sept 2026 date-range
 * redesign) never matches the query below, so it simply never reminds —
 * there's nothing to count down to. */
@Injectable()
export class TripNotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TripNotificationsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(TripNotificationDelivery)
    private readonly deliveryRepo: Repository<TripNotificationDelivery>,
    @InjectRepository(Itinerary)
    private readonly itineraryRepo: Repository<Itinerary>,
    @InjectRepository(ItineraryCollaborator)
    private readonly collaboratorRepo: Repository<ItineraryCollaborator>,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    // Same reasoning as EventNotificationsService: a minute-level
    // deterministic job belongs in the API process, and the delivery
    // table makes repeated ticks safe rather than needing a separate
    // scheduler service.
    void this.processDueReminders();
    this.timer = setInterval(() => void this.processDueReminders(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Public (not private, unlike EventNotificationsService's twin) so the
   * unit tests below can drive one tick directly instead of waiting on
   * the interval or faking module lifecycle hooks. */
  async processDueReminders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 60_000);
      const lookaheadEnd = new Date(now.getTime() + LOOKAHEAD_MS + 60_000);
      const trips = await this.itineraryRepo.find({
        where: {
          startDate: Between(now, lookaheadEnd),
          cancelledAt: IsNull(),
        },
        relations: ["user"],
        order: { startDate: "ASC" },
        take: 100,
      });
      for (const trip of trips) {
        if (!trip.startDate) continue;
        const due = this.remindersFor(trip.startDate, now, windowEnd);
        if (due.length === 0) continue;
        const collaborators = await this.collaboratorRepo.find({
          where: { itineraryId: trip.id },
        });
        for (const reminder of due) {
          const destinationName = trip.destination?.name ?? "Liberia";
          const title = `"${trip.title}" starts in ${reminder.label}`;
          const body = `Your trip to ${destinationName} starts in ${reminder.label}. Make sure everything's ready to go.`;
          const recipients = new Map<string, User>();
          if (trip.user) recipients.set(trip.user.id, trip.user);
          for (const collaborator of collaborators) {
            if (collaborator.user)
              recipients.set(collaborator.user.id, collaborator.user);
          }
          for (const recipient of recipients.values()) {
            await this.deliverOnce({
              trip,
              recipient,
              kind: reminder.kind,
              title,
              body,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Trip reminder job failed: ${(error as Error).message}`,
      );
    } finally {
      this.running = false;
    }
  }

  private remindersFor(
    start: Date,
    now: Date,
    windowEnd: Date,
  ): Array<{ kind: string; label: string }> {
    return REMINDER_TARGETS.filter((target) => {
      const targetAt = new Date(start.getTime() - target.offsetMs);
      return targetAt >= now && targetAt < windowEnd;
    });
  }

  private async deliverOnce(input: {
    trip: Itinerary;
    recipient: User;
    kind: string;
    title: string;
    body: string;
  }): Promise<void> {
    const link = `/trips/${input.trip.id}`;
    let delivery = await this.deliveryRepo.findOne({
      where: {
        itineraryId: input.trip.id,
        recipientUserId: input.recipient.id,
        kind: input.kind,
      },
    });
    delivery =
      delivery ??
      this.deliveryRepo.create({
        itineraryId: input.trip.id,
        recipientUserId: input.recipient.id,
        kind: input.kind,
        inAppSent: false,
        emailSent: false,
        sentAt: null,
      });
    if (delivery.inAppSent && delivery.emailSent) return;

    if (!delivery.inAppSent) {
      await this.notificationsService.create(input.recipient.id, {
        type: "trip.reminder",
        title: input.title,
        body: input.body,
        link,
      });
      delivery.inAppSent = true;
    }
    if (!delivery.emailSent && input.recipient.email) {
      delivery.emailSent = await this.mailService.sendTripNotification({
        to: input.recipient.email,
        subject: input.title,
        heading: input.title,
        body: input.body,
        ctaLabel: "View trip",
        ctaUrl: `${this.configService.get("webAppUrl", { infer: true })}${link}`,
      });
    }
    if (delivery.inAppSent || delivery.emailSent) delivery.sentAt = new Date();
    await this.deliveryRepo.save(delivery);
  }
}
