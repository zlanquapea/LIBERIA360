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
import { Creator } from "../../creators/entities/creator.entity";
import { Advertisement } from "../../advertisements/entities/advertisement.entity";
import { Event } from "../../events/entities/event.entity";
import { AnalyticsEventType } from "./analytics-event.enums";

/**
 * Append-only event log — one row per view/save/contact-click/booking-
 * request. No `updatedAt`; a row is never edited after it's written. Not
 * tied to a user (anonymous by design — same "views/saves" a logged-out
 * visitor generates count too, and the B2B analytics product is explicitly
 * meant to be aggregate/anonymized, not per-visitor).
 *
 * Targets exactly one of a Place, a Creator, an Advertisement, or an
 * Event, never more than one — same XOR-at-the-service-layer convention as
 * Review (see its doc comment), and the same "NULL is distinct" reasoning
 * for why one nullable FK per target works. The B2B aggregate tourism
 * analytics queries (admin-analytics.service.ts) are place-specific and
 * explicitly filter out creator-only rows (a creator isn't a destination)
 * — see that file's comments at each query this affects; an advertisement
 * or an event isn't a destination either; same exclusion applies there.
 */
@Entity("analytics_events")
export class AnalyticsEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Place, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "place_id" })
  place: Place | null;

  @Index()
  @Column({ name: "place_id", nullable: true })
  placeId: string | null;

  @ManyToOne(() => Creator, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "creator_id" })
  creator: Creator | null;

  @Index()
  @Column({ name: "creator_id", nullable: true })
  creatorId: string | null;

  @ManyToOne(() => Advertisement, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "advertisement_id" })
  advertisement: Advertisement | null;

  @Index()
  @Column({ name: "advertisement_id", nullable: true })
  advertisementId: string | null;

  @ManyToOne(() => Event, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "event_id" })
  event: Event | null;

  @Index()
  @Column({ name: "event_id", nullable: true })
  eventId: string | null;

  @Index()
  @Column({ name: "event_type", type: "enum", enum: AnalyticsEventType })
  eventType: AnalyticsEventType;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
