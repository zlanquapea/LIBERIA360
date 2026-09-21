import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

@Entity("event_notification_deliveries")
@Unique(["eventId", "recipientUserId", "kind", "referenceId"])
@Index(["eventId", "kind"])
export class EventNotificationDelivery {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Column({ name: "recipient_user_id", type: "uuid" })
  recipientUserId: string;

  /** Stable lifecycle/reminder key, e.g. reminder_2d or ticket_order_approved. */
  @Column({ type: "varchar", length: 80 })
  kind: string;

  /** A ticket-order or RSVP identifier when the same kind can occur more than once. */
  @Column({ name: "reference_id", type: "varchar", length: 100, default: "" })
  referenceId: string;

  @Column({ name: "in_app_sent", type: "boolean", default: false })
  inAppSent: boolean;

  @Column({ name: "email_sent", type: "boolean", default: false })
  emailSent: boolean;

  @Column({ name: "push_sent", type: "boolean", default: false })
  pushSent: boolean;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
