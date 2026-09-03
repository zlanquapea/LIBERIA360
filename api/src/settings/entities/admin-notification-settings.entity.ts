import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

/** Settings > Notifications — which admin events send an email or push
 * notification, and to whom (Settings placeholder body, before this:
 * "a general settings UI to route other events to other people isn't
 * built yet"). A true singleton, same shape as ApplicationSettings —
 * exactly one row, always id=1, created with defaults on first read.
 *
 * Only one event is routable here today: new flagged content (a
 * review/event that just crossed Application's report-flag threshold —
 * see ReportsService.maybeNotifyContentFlagged). Failed-login threshold
 * alerts are NOT part of this table on purpose — they already email
 * every super admin unconditionally (LoginActivityService.emailSuperAdmins),
 * a narrower and higher-stakes audience than "whoever moderates content,"
 * and changing who receives those is a security decision, not a
 * notification-routing preference. */
@Entity("admin_notification_settings")
export class AdminNotificationSettings {
  @PrimaryColumn({ type: "int" })
  id: number;

  @Column({
    name: "flagged_content_email_enabled",
    type: "boolean",
    default: true,
  })
  flaggedContentEmailEnabled: boolean;

  @Column({
    name: "flagged_content_push_enabled",
    type: "boolean",
    default: false,
  })
  flaggedContentPushEnabled: boolean;

  // Empty = "every admin" (matches the default every other admin.* event
  // already uses — see UsersService.findAdminIds' call sites). A non-empty
  // list narrows delivery to specific admins instead, e.g. one designated
  // moderator instead of paging the whole team for every flagged review.
  @Column({
    name: "flagged_content_recipient_user_ids",
    type: "text",
    array: true,
    default: () => "'{}'",
  })
  flaggedContentRecipientUserIds: string[];

  @Column({ name: "updated_by_user_id", type: "uuid", nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
