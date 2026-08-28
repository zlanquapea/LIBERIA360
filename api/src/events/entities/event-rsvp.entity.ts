import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Event } from "./event.entity";
import { EventRsvpStatus } from "./event.enums";

// One row per (event, user) — mirrors CreatorPostLike/CreatorPostSave's
// shape. `status` (not two separate boolean tables) because a viewer is
// either Interested or Going, never both — see EventRsvpStatus's doc
// comment.
@Entity("event_rsvps")
@Unique(["eventId", "userId"])
export class EventRsvp {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event: Event;

  @Index()
  @Column({ name: "event_id" })
  eventId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id" })
  userId: string;

  @Column({ type: "enum", enum: EventRsvpStatus })
  status: EventRsvpStatus;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
