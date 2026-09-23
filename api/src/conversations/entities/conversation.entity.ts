import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { ConversationParticipant } from "./conversation-participant.entity";
import { ConversationMessage } from "./conversation-message.entity";

@Entity("conversations")
@Index(["contextType", "contextId"])
@Index(["lastMessageAt"])
export class Conversation {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({
    name: "context_type",
    type: "varchar",
    length: 60,
    default: "direct",
  })
  contextType: string;
  @Column({ name: "context_id", type: "uuid", nullable: true }) contextId:
    string | null;
  @Column({ type: "varchar", length: 180, nullable: true }) title:
    string | null;
  @Column({ name: "avatar_url", type: "varchar", length: 500, nullable: true })
  avatarUrl: string | null;
  @Column({ name: "last_message_at", type: "timestamptz", nullable: true })
  lastMessageAt: Date | null;
  @OneToMany(
    () => ConversationParticipant,
    (participant) => participant.conversation,
  )
  participants: ConversationParticipant[];
  @OneToMany(() => ConversationMessage, (message) => message.conversation)
  messages: ConversationMessage[];
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
