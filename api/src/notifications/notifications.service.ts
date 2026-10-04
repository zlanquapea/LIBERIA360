import {
  groupPrefixes,
  notificationGroup,
  NotificationGroup,
} from "./notification-groups";
import { NotificationPreferencesDto } from "./dto/notification-preferences.dto";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Like, FindOperator, Repository } from "typeorm";
import { Notification, NotificationType } from "./entities/notification.entity";
import { PushService } from "../push/push.service";

export interface PaginatedNotifications {
  data: Notification[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Event notifications use their own delivery ledger and push retry path. */
  skipPush?: boolean;
}

/** The in-app notification center — see Notification's own doc comment for
 * what a row means and why this exists alongside (not instead of) email
 * and browser push. Every other service that needs to notify a user calls
 * `create`/`createMany` here rather than writing to the repository
 * directly, the same way AdminAuditService is the one place that writes
 * `admin_actions` rows. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly pushService: PushService,
  ) {}

  async preferences(userId: string): Promise<NotificationPreferencesDto> {
    const rows = await this.notificationRepo.manager.query(
      "SELECT preferences FROM notification_preferences WHERE user_id = $1",
      [userId],
    );
    return {
      bookings: true,
      messages: true,
      trips: true,
      creators: true,
      ...rows[0]?.preferences,
    };
  }
  async setPreferences(
    userId: string,
    preferences: NotificationPreferencesDto,
  ) {
    await this.notificationRepo.manager.query(
      "INSERT INTO notification_preferences (user_id, preferences) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET preferences = EXCLUDED.preferences",
      [userId, JSON.stringify(preferences)],
    );
    return preferences;
  }
  private async allowsPush(userId: string, type: string) {
    const group = notificationGroup(type);
    return !group || (await this.preferences(userId))[group];
  }

  /** Notifies a single user — the common case (a booking's guest or
   * owner, a place/business submitter). Never throws: a notification that
   * fails to write should never fail the real action that triggered it,
   * same contract as AdminAuditService.log. */
  async create(userId: string, input: CreateNotificationInput): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to exclude it from notificationInput below
      const { skipPush: _skipPush, ...notificationInput } = input;
      await this.notificationRepo.save(
        this.notificationRepo.create({
          userId,
          ...notificationInput,
          link: notificationInput.link ?? null,
        }),
      );
      if (!input.skipPush && (await this.allowsPush(userId, input.type))) {
        void this.pushService
          .sendToUsers([userId], {
            title: input.title,
            body: input.body,
            url: input.link,
          })
          .catch(() => undefined);
      }
    } catch {
      // Swallowed on purpose — see this method's doc comment.
    }
  }

  /** Notifies every user in the list — the "broadcast to all admins" case
   * (a new place/business pending review, a failed-login threshold
   * crossed). One row per recipient, not one shared row, so each admin's
   * read state is independent — one admin dismissing it shouldn't hide it
   * from the others. */
  async createMany(
    userIds: string[],
    input: CreateNotificationInput,
  ): Promise<void> {
    if (userIds.length === 0) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to exclude it from notificationInput below
      const { skipPush: _skipPush, ...notificationInput } = input;
      await this.notificationRepo.save(
        userIds.map((userId) =>
          this.notificationRepo.create({
            userId,
            ...notificationInput,
            link: notificationInput.link ?? null,
          }),
        ),
      );
      if (!input.skipPush) {
        const allowed = await Promise.all(
          userIds.map(async (id) =>
            (await this.allowsPush(id, input.type)) ? id : null,
          ),
        );
        const pushUserIds = allowed.filter((id): id is string => id !== null);
        if (!pushUserIds.length) return;
        void this.pushService
          .sendToUsers(pushUserIds, {
            title: input.title,
            body: input.body,
            url: input.link,
          })
          .catch(() => undefined);
      }
    } catch {
      // Swallowed on purpose — see create's doc comment.
    }
  }

  async findForUser(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      group?: NotificationGroup;
    } = {},
  ): Promise<PaginatedNotifications> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [data, total] = await this.notificationRepo.findAndCount({
      where: params.group
        ? groupPrefixes[params.group].map((prefix) => ({
            userId,
            ...(params.unreadOnly ? { read: false } : {}),
            type: Like(prefix) as FindOperator<NotificationType>,
          }))
        : params.unreadOnly
          ? { userId, read: false }
          : { userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

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

  getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({ where: { userId, read: false } });
  }

  /** Ownership-checked — a user can only ever mark their own notification
   * read, the same boundary BookingMessagesService.assertParticipant
   * enforces for messages. */
  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification "${id}" not found`);
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        "You can only mark your own notifications read",
      );
    }
    if (!notification.read) {
      notification.read = true;
      await this.notificationRepo.save(notification);
    }
    return notification;
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo.update({ userId, read: false }, { read: true });
  }
}
