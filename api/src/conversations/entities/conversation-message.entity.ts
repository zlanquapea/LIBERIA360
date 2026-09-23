import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Conversation } from "./conversation.entity";

@Entity("conversation_messages")
@Index(["conversationId", "createdAt"])
export class ConversationMessage {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;
  @Column({ name: "conversation_id", type: "uuid" }) conversationId: string;
  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_id" })
  sender: User;
  @Column({ name: "sender_id", type: "uuid" }) senderId: string;
  @Column({ type: "text" }) body: string;
  @Column({
    name: "message_type",
    type: "varchar",
    length: 30,
    default: "text",
  })
  messageType: string;
  @Column({ type: "jsonb", default: () => "'[]'" }) attachments: Array<
    Record<string, unknown>
  >;
  @Column({ type: "jsonb", default: () => "'{}'" }) reactions: Record<
    string,
    string[]
  >;
  @Column({ name: "delivered_at", type: "timestamptz", nullable: true })
  deliveredAt: Date | null;
  @Column({ name: "read_at", type: "timestamptz", nullable: true })
  readAt: Date | null;
  @Column({ name: "edited_at", type: "timestamptz", nullable: true })
  editedAt: Date | null;
  @Column({ name: "deleted_at", type: "timestamptz", nullable: true })
  deletedAt: Date | null;
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
