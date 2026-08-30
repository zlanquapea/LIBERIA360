import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

// Short, stable, dot-namespaced — same convention as AdminAction.action and
// LoginActivity.reason — so this stays filterable/switchable-on as the list
// of triggers grows, rather than a free-text label. `booking.*` and
// `booking_message.*` fire for the guest or the business/creator owner
// (whichever the trigger targets); `place.*`/`business.*` fire for a
// self-submitted listing's owner when an admin decides it; `admin.*` fire
// for every admin (or every super admin, for `admin.failed_login_alert`) —
// see NotificationsService's call sites for exactly who gets each one.
export type NotificationType =
  | "booking.requested"
  | "booking.confirmed"
  | "booking.declined"
  | "booking_message.received"
  | "place.review_decided"
  | "business.review_decided"
  | "admin.place_pending_review"
  | "admin.business_pending_review"
  | "admin.advertisement_pending_review"
  | "advertisement.review_decided"
  | "admin.event_pending_review"
  | "event.review_decided"
  | "admin.car_listing_pending_review"
  | "car_listing.review_decided"
  | "support.agent_replied"
  | "support.status_changed"
  | "admin.support_ticket_created"
  | "admin.support_ticket_assigned"
  | "admin.support_customer_replied"
  | "admin.failed_login_alert";

/**
 * The in-app notification center's one table — every notification, for
 * every user (a regular traveler, a business/creator owner, or an admin;
 * there's no separate "admin notification" concept, just a row whose
 * `userId` happens to belong to an admin). Read-mostly after creation:
 * nothing ever updates a row except flipping `read`, and nothing deletes
 * one — a user's notification history is exactly that, a history.
 *
 * Deliberately NOT a substitute for the transactional emails MailService
 * already sends (password reset, admin invites, trip invitations, ...) —
 * this is the "you were signed in and didn't see it happen live" record,
 * and the one durable channel that works whether or not push notifications
 * are configured/granted (see push/push.service.ts's doc comment: browser
 * push is a best-effort, fire-and-forget progressive enhancement with no
 * history of its own).
 */
@Entity("notifications")
@Index(["userId", "createdAt"])
@Index(["userId", "read"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Plain scalar, not a relation — same reasoning as Place.ownerUserId and
  // AdminAction.adminUserId: this row is fetched constantly (every poll of
  // the bell's unread count, every page of the notification list) and
  // never needs more than an id to link back to the recipient.
  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({ type: "varchar", length: 60 })
  type: NotificationType;

  @Column({ type: "varchar", length: 200 })
  title: string;

  @Column({ type: "text" })
  body: string;

  // Where clicking the notification takes you — a relative in-app path
  // (e.g. "/account/bookings", "/admin/content/moderation"), not an
  // absolute URL; null for a notification with nothing to navigate to.
  @Column({ type: "varchar", length: 300, nullable: true })
  link: string | null;

  @Column({ type: "boolean", default: false })
  read: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
