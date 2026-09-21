import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";

@Entity("trip_notification_deliveries")
@Unique(["itineraryId", "recipientUserId", "kind"])
@Index(["itineraryId", "kind"])
export class TripNotificationDelivery {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "itinerary_id", type: "uuid" })
  itineraryId: string;

  @Column({ name: "recipient_user_id", type: "uuid" })
  recipientUserId: string;

  /** Stable reminder key, e.g. reminder_3d or reminder_1h — see
   * TripNotificationsService.remindersFor. Unlike EventNotificationDelivery,
   * there's no referenceId column: a trip reminder never recurs for the
   * same recipient+kind the way a ticket-order or RSVP notice can. */
  @Column({ type: "varchar", length: 80 })
  kind: string;

  @Column({ name: "in_app_sent", type: "boolean", default: false })
  inAppSent: boolean;

  @Column({ name: "email_sent", type: "boolean", default: false })
  emailSent: boolean;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
