import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { Itinerary } from "../../itineraries/entities/itinerary.entity";
import { User } from "../../users/entities/user.entity";

/**
 * One member's read cursor for one trip's chat (Section 10's "delivery
 * status Sending/Sent/Delivered/Read") — not a row per message per
 * viewer. `lastDeliveredAt`/`lastReadAt` only ever advance forward (see
 * TripChatService.markDelivered/markRead): "this member's client has
 * fetched everything up to this instant" / "...has had the thread open
 * and visible up to this instant". A message's own aggregate status is
 * computed on read by comparing every *other* current member's row here
 * against that message's `createdAt` — Read once every other member's
 * `lastReadAt` is past it, Delivered once every other member's
 * `lastDeliveredAt` is, otherwise just Sent. The same simplification
 * Slack's read cursors make instead of a full delivery/read receipt
 * table, which is the right trade for a chat that only ever has a
 * handful of participants (a trip's roster), not the wrong one at scale.
 */
@Entity("trip_chat_read_states")
@Unique(["itineraryId", "userId"])
export class TripChatReadState {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary: Itinerary;

  @Index()
  @Column({ name: "itinerary_id" })
  itineraryId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id" })
  userId: string;

  @Column({ name: "last_delivered_at", type: "timestamptz", nullable: true })
  lastDeliveredAt: Date | null;

  @Column({ name: "last_read_at", type: "timestamptz", nullable: true })
  lastReadAt: Date | null;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
