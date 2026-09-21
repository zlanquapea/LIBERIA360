import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Between, Repository } from "typeorm";
import { Event } from "../events/entities/event.entity";
import { EventRsvp } from "../events/entities/event-rsvp.entity";
import { EventRsvpStatus } from "../events/entities/event.enums";
import {
  EventTicketOrder,
  EventTicketOrderStatus,
} from "../event-tickets/entities/event-ticket-order.entity";
import { User } from "../users/entities/user.entity";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PushService } from "../push/push.service";
import { EventNotificationDelivery } from "./entities/event-notification-delivery.entity";
import { AppConfig } from "../config/configuration";

interface Recipient {
  user: User;
  referenceId?: string;
}

@Injectable()
export class EventNotificationsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EventNotificationsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(EventNotificationDelivery)
    private readonly deliveryRepo: Repository<EventNotificationDelivery>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(EventRsvp)
    private readonly rsvpRepo: Repository<EventRsvp>,
    @InjectRepository(EventTicketOrder)
    private readonly orderRepo: Repository<EventTicketOrder>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    // A minute-level deterministic job belongs in the API process, not a
    // Manus reminder. The delivery table makes repeated ticks safe.
    void this.processDueReminders();
    this.timer = setInterval(() => void this.processDueReminders(), 60_000);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async notifyEventLifecycle(
    event: Event,
    kind: string,
    title: string,
    body: string,
    link = `/events/${event.id}`,
    recipients: Recipient[] = [],
    sendInApp = true,
  ): Promise<void> {
    const unique = new Map<string, Recipient>();
    for (const recipient of recipients)
      unique.set(recipient.user.id, recipient);
    for (const recipient of unique.values()) {
      await this.deliverOnce({
        event,
        recipient: recipient.user,
        kind,
        referenceId: recipient.referenceId ?? "",
        title,
        body,
        link,
        sendInApp,
      });
    }
  }

  async notifyOrganizer(
    event: Event,
    kind: string,
    title: string,
    body: string,
    referenceId = "",
    sendInApp = true,
  ): Promise<void> {
    const organizer = await this.userRepo.findOne({
      where: { id: event.createdByUserId },
    });
    if (!organizer) return;
    await this.notifyEventLifecycle(
      event,
      kind,
      title,
      body,
      `/account/my-events`,
      [{ user: organizer, referenceId }],
      sendInApp,
    );
  }

  async notifyUser(
    event: Event,
    userId: string,
    kind: string,
    title: string,
    body: string,
    link = `/events/${event.id}`,
    referenceId = "",
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    await this.notifyEventLifecycle(event, kind, title, body, link, [
      { user, referenceId },
    ]);
  }

  async notifyRsvpParticipants(
    event: Event,
    kind: string,
    title: string,
    body: string,
  ): Promise<void> {
    const rsvps = await this.rsvpRepo.find({
      where: { eventId: event.id, status: EventRsvpStatus.GOING },
      relations: ["user"],
    });
    await this.notifyEventLifecycle(
      event,
      kind,
      title,
      body,
      `/events/${event.id}`,
      rsvps.filter((rsvp) => rsvp.user).map((rsvp) => ({ user: rsvp.user })),
    );
  }

  async notifyTicketParticipants(
    event: Event,
    kind: string,
    title: string,
    body: string,
  ): Promise<void> {
    const orders = await this.orderRepo.find({
      where: { eventId: event.id, status: EventTicketOrderStatus.APPROVED },
      relations: ["buyer"],
    });
    await this.notifyEventLifecycle(
      event,
      kind,
      title,
      body,
      `/account/my-tickets`,
      orders
        .filter((order) => order.buyer)
        .map((order) => ({ user: order.buyer, referenceId: order.id })),
    );
  }

  private async deliverOnce(input: {
    event: Event;
    recipient: User;
    kind: string;
    referenceId: string;
    title: string;
    body: string;
    link: string;
    sendInApp: boolean;
  }): Promise<void> {
    let delivery = await this.deliveryRepo.findOne({
      where: {
        eventId: input.event.id,
        recipientUserId: input.recipient.id,
        kind: input.kind,
        referenceId: input.referenceId,
      },
    });
    delivery =
      delivery ??
      this.deliveryRepo.create({
        eventId: input.event.id,
        recipientUserId: input.recipient.id,
        kind: input.kind,
        referenceId: input.referenceId,
        inAppSent: false,
        emailSent: false,
        pushSent: false,
        sentAt: null,
      });
    if (
      (!input.sendInApp || delivery.inAppSent) &&
      delivery.emailSent &&
      delivery.pushSent
    )
      return;

    if (input.sendInApp && !delivery.inAppSent) {
      await this.notificationsService.create(input.recipient.id, {
        type: this.notificationType(input.kind),
        title: input.title,
        body: input.body,
        link: input.link,
        skipPush: true,
      });
      delivery.inAppSent = true;
    }
    if (!delivery.pushSent) {
      delivery.pushSent = await this.pushService.sendToUsers([input.recipient.id], {
        title: input.title,
        body: input.body,
        url: input.link,
      });
    }
    if (!delivery.emailSent && input.recipient.email) {
      delivery.emailSent = await this.mailService.sendEventNotification({
        to: input.recipient.email,
        subject: input.title,
        heading: input.title,
        body: input.body,
        ctaLabel: "View event",
        ctaUrl: `${this.configService.get("webAppUrl", { infer: true })}${input.link}`,
      });
    }
    if (
      (input.sendInApp && delivery.inAppSent) ||
      delivery.emailSent ||
      delivery.pushSent
    )
      delivery.sentAt = new Date();
    await this.deliveryRepo.save(delivery);
  }

  private notificationType(kind: string): "event.lifecycle" | "event.reminder" {
    return kind.startsWith("reminder_") ? "event.reminder" : "event.lifecycle";
  }

  private async processDueReminders(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 60_000);
      const twoDaysAndOneMinute = new Date(now.getTime() + 172_860_000);
      const events = await this.eventRepo.find({
        where: {
          startDate: Between(now, twoDaysAndOneMinute),
        },
        relations: ["createdBy"],
        order: { startDate: "ASC" },
        take: 100,
      });
      for (const event of events) {
        for (const reminder of this.remindersFor(
          event.startDate,
          now,
          windowEnd,
        )) {
          const label = reminder.label;
          const title = `${event.name} starts in ${label}`;
          const body = `Your event in ${event.locationText ?? event.county?.name ?? "Liberia"} starts in ${label}.`;
          await this.notifyOrganizer(event, reminder.kind, title, body);
          await this.notifyRsvpParticipants(event, reminder.kind, title, body);
          await this.notifyTicketParticipants(
            event,
            reminder.kind,
            title,
            body,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Event reminder job failed: ${(error as Error).message}`,
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
    const targets = [
      { kind: "reminder_2d", label: "2 days" },
      { kind: "reminder_1d", label: "1 day" },
      { kind: "reminder_30m", label: "30 minutes" },
    ];
    return targets.filter((target) => {
      const offset =
        target.kind === "reminder_2d"
          ? 172_800_000
          : target.kind === "reminder_1d"
            ? 86_400_000
            : 1_800_000;
      const targetAt = new Date(start.getTime() - offset);
      return targetAt >= now && targetAt < windowEnd;
    });
  }
}
