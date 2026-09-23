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
import { User } from "../../users/entities/user.entity";
import { Conversation } from "./conversation.entity";

@Entity("conversation_participants")
@Unique(["conversationId", "userId"])
@Index(["userId", "lastReadAt"])
export class ConversationParticipant {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => Conversation, (conversation) => conversation.participants, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;
  @Column({ name: "conversation_id", type: "uuid" }) conversationId: string;
  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
  @Column({ name: "user_id", type: "uuid" }) userId: string;
  @Column({ type: "varchar", length: 30, default: "member" }) role: string;
  @Column({ name: "last_read_at", type: "timestamptz", nullable: true })
  lastReadAt: Date | null;
  @Column({ default: false }) muted: boolean;
  @Column({ default: false }) archived: boolean;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
