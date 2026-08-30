import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { SupportMessage } from "./support-message.entity";

export enum SupportTicketStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  WAITING_FOR_CUSTOMER = "waiting_for_customer",
  RESOLVED = "resolved",
  CLOSED = "closed",
}
export enum SupportTicketPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}
export enum SupportTicketCategory {
  ACCOUNT = "account",
  BOOKING = "booking",
  PAYMENT = "payment",
  LISTING = "listing",
  TECHNICAL = "technical",
  SAFETY = "safety",
  FEEDBACK = "feedback",
  OTHER = "other",
}

@Entity("support_tickets")
@Index(["customerUserId", "createdAt"])
@Index(["status", "priority", "createdAt"])
export class SupportTicket {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "varchar", length: 20, unique: true }) reference: string;
  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "customer_user_id" })
  customer: User;
  @Column({ name: "customer_user_id", type: "uuid" }) customerUserId: string;
  @ManyToOne(() => User, { eager: true, nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "assigned_agent_user_id" })
  assignedAgent: User | null;
  @Column({ name: "assigned_agent_user_id", type: "uuid", nullable: true })
  assignedAgentUserId: string | null;
  @Column({ type: "enum", enum: SupportTicketCategory })
  category: SupportTicketCategory;
  @Column({ type: "varchar", length: 180 }) subject: string;
  @Column({ type: "text" }) description: string;
  @Column({ type: "text", array: true, default: () => "'{}'" })
  attachments: string[];
  @Column({
    type: "enum",
    enum: SupportTicketStatus,
    default: SupportTicketStatus.OPEN,
  })
  status: SupportTicketStatus;
  @Column({
    type: "enum",
    enum: SupportTicketPriority,
    default: SupportTicketPriority.MEDIUM,
  })
  priority: SupportTicketPriority;
  @Column({ type: "smallint", nullable: true }) rating: number | null;
  @Column({ name: "rating_comment", type: "text", nullable: true })
  ratingComment: string | null;
  @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
  resolvedAt: Date | null;
  @Column({ name: "closed_at", type: "timestamptz", nullable: true })
  closedAt: Date | null;
  @OneToMany(() => SupportMessage, (message) => message.ticket)
  messages: SupportMessage[];
  @CreateDateColumn({ name: "created_at" }) createdAt: Date;
  @UpdateDateColumn({ name: "updated_at" }) updatedAt: Date;
}
