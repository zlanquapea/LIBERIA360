import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { MoreThanOrEqual, Repository } from "typeorm";
import { ContentReport } from "./entities/content-report.entity";
import { ReportTargetType } from "./entities/content-report.enums";
import { Review } from "../reviews/entities/review.entity";
import { Event } from "../events/entities/event.entity";
import { Business } from "../businesses/entities/business.entity";
import { CreateContentReportDto } from "./dto/create-content-report.dto";
import { SettingsService } from "../settings/settings.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { PushService } from "../push/push.service";
import { UsersService } from "../users/users.service";
import { AppConfig } from "../config/configuration";

const MODERATION_QUEUE_LINK = "/admin/content/moderation";

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ContentReport)
    private readonly reportRepo: Repository<ContentReport>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    private readonly settingsService: SettingsService,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
    private readonly pushService: PushService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  /** Upsert on (reporterUserId, targetType, targetId) — see the entity's
   * doc comment for why a second report from the same user replaces the
   * first instead of piling up alongside it. */
  async report(
    userId: string,
    dto: CreateContentReportDto,
  ): Promise<ContentReport> {
    await this.assertTargetExists(dto.targetType, dto.targetId);

    const existing = await this.reportRepo.findOne({
      where: {
        reporterUserId: userId,
        targetType: dto.targetType,
        targetId: dto.targetId,
      },
    });
    const saved = existing
      ? await this.reportRepo.save(
          Object.assign(existing, {
            reason: dto.reason,
            details: dto.details ?? null,
          }),
        )
      : await this.reportRepo.save(
          this.reportRepo.create({
            reporterUserId: userId,
            targetType: dto.targetType,
            targetId: dto.targetId,
            reason: dto.reason,
            details: dto.details ?? null,
          }),
        );

    // Only on a genuinely new report, not an edit of an existing one — an
    // editing reporter doesn't change the independent-reporter count that
    // decides whether this target just became flagged content.
    if (!existing) {
      await this.maybeNotifyContentFlagged(dto.targetType, dto.targetId);
    }
    return saved;
  }

  private async assertTargetExists(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<void> {
    const exists = await (targetType === ReportTargetType.REVIEW
      ? this.reviewRepo.exists({ where: { id: targetId } })
      : targetType === ReportTargetType.EVENT
        ? this.eventRepo.exists({ where: { id: targetId } })
        : this.businessRepo.exists({ where: { id: targetId } }));
    if (!exists) {
      throw new NotFoundException(`${targetType} "${targetId}" not found`);
    }
  }

  /** Settings > Notifications' "new flagged content" trigger — fires the
   * moment a review/event first satisfies the same `count >= threshold`
   * condition AdminService.findFlaggedContent uses to decide a target
   * belongs in the moderation queue at all, so this fires exactly when it
   * would first appear there (never fires again on later reports against
   * the same target — see the `count !== threshold` guard below).
   *
   * Businesses are reportable too (ReportTargetType.BUSINESS), but they
   * already have their own review/verification lifecycle and don't feed
   * the "Flagged content" queue the way reviews/events do (see
   * AdminService's doc comment on getModerationQueue), so they're
   * excluded here rather than silently mis-notifying about a target the
   * moderation queue doesn't actually treat as flagged. */
  private async maybeNotifyContentFlagged(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<void> {
    if (
      targetType !== ReportTargetType.REVIEW &&
      targetType !== ReportTargetType.EVENT
    ) {
      return;
    }

    const settings = await this.settingsService.getApplicationSettings();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - settings.reportWindowDays);
    const count = await this.reportRepo.count({
      where: { targetType, targetId, createdAt: MoreThanOrEqual(windowStart) },
    });
    if (count !== settings.reportFlagThreshold) return;

    const prefs = await this.settingsService.getAdminNotificationSettings();
    const recipients =
      prefs.flaggedContentRecipientUserIds.length > 0
        ? await this.usersService.findByIds(
            prefs.flaggedContentRecipientUserIds,
          )
        : await this.usersService.findAdmins();
    if (recipients.length === 0) return;

    const recipientIds = recipients.map((admin) => admin.id);
    const targetLabel = await this.describeFlaggedTarget(targetType, targetId);
    const body = `${targetLabel} was just reported by ${count} independent users.`;

    // The in-app bell entry is the always-on baseline (same as every
    // other admin.* broadcast) — email and push are the two optional
    // add-ons Settings > Notifications actually toggles.
    await this.notificationsService.createMany(recipientIds, {
      type: "admin.content_flagged",
      title: "New flagged content",
      body,
      link: MODERATION_QUEUE_LINK,
    });

    if (prefs.flaggedContentEmailEnabled) {
      const webAppUrl = this.configService.get("webAppUrl", { infer: true });
      const moderationUrl = `${webAppUrl}${MODERATION_QUEUE_LINK}`;
      await Promise.all(
        recipients.map((admin) =>
          this.mailService
            .sendFlaggedContentAlert(
              admin.email,
              admin.name,
              targetLabel,
              count,
              moderationUrl,
            )
            .catch(() => undefined),
        ),
      );
    }

    if (prefs.flaggedContentPushEnabled) {
      await this.pushService.sendToUsers(recipientIds, {
        title: "New flagged content",
        body,
        url: MODERATION_QUEUE_LINK,
      });
    }
  }

  private async describeFlaggedTarget(
    targetType: ReportTargetType,
    targetId: string,
  ): Promise<string> {
    if (targetType === ReportTargetType.REVIEW) {
      const review = await this.reviewRepo.findOne({
        where: { id: targetId },
        relations: ["user"],
      });
      return review
        ? `A review by ${review.user?.name ?? "a guest"}`
        : "A review";
    }
    const event = await this.eventRepo.findOne({ where: { id: targetId } });
    return event ? `The event "${event.name}"` : "An event";
  }
}
