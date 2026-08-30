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
import { SupportTicket } from "./support-ticket.entity";

@Entity("support_messages")
@Index(["ticketId", "createdAt"])
export class SupportMessage {
  @PrimaryGeneratedColumn("uuid") id: string;
  @ManyToOne(() => SupportTicket, (ticket) => ticket.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "ticket_id" })
  ticket: SupportTicket;
  @Column({ name: "ticket_id", type: "uuid" }) ticketId: string;
  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_user_id" })
  sender: User;
  @Column({ name: "sender_user_id", type: "uuid" }) senderUserId: string;
  @Column({ type: "text" }) body: string;
  @Column({ type: "text", array: true, default: () => "'{}'" })
  attachments: string[];
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
}
