import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Place } from "../../places/entities/place.entity";
import { AnalyticsEventType } from "./analytics-event.enums";

/**
 * Append-only event log — one row per view/save/contact-click/booking-
 * request. No `updatedAt`; a row is never edited after it's written. Not
 * tied to a user (anonymous by design — same "views/saves" a logged-out
 * visitor generates count too, and the B2B analytics product is explicitly
 * meant to be aggregate/anonymized, not per-visitor).
 */
@Entity("analytics_events")
export class AnalyticsEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Place, { onDelete: "CASCADE" })
  @JoinColumn({ name: "place_id" })
  place: Place;

  @Index()
  @Column({ name: "place_id" })
  placeId: string;

  @Index()
  @Column({ name: "event_type", type: "enum", enum: AnalyticsEventType })
  eventType: AnalyticsEventType;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
