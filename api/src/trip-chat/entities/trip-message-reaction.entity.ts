import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";
import { TripMessage } from "./trip-message.entity";
import { User } from "../../users/entities/user.entity";

/**
 * One person's reaction to one chat message (Section 12's "reactions").
 * `@Unique` lets the same user react to the same message with several
 * *different* emoji, but toggling the same one twice removes it —
 * TripChatService.toggleReaction relies on that constraint rather than
 * checking for an existing row itself. Stored as plain text against a
 * small server-side allow-list (TripChatService.ALLOWED_REACTIONS)
 * instead of a DB enum, so adding another option to the picker later is
 * a one-line frontend/allow-list change, not a migration.
 */
@Entity("trip_message_reactions")
@Unique(["messageId", "userId", "emoji"])
export class TripMessageReaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => TripMessage, { onDelete: "CASCADE" })
  @JoinColumn({ name: "message_id" })
  message: TripMessage;

  @Index()
  @Column({ name: "message_id" })
  messageId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "user_id" })
  userId: string;

  @Column({ type: "varchar", length: 16 })
  emoji: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
