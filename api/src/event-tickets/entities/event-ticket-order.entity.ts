import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Event } from "../../events/entities/event.entity";
import { User } from "../../users/entities/user.entity";

export enum EventTicketOrderStatus {
  PENDING_PAYMENT_REVIEW = "pending_payment_review",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

@Entity("event_ticket_orders")
@Index(["eventId", "paymentReference"], { unique: true })
export class EventTicketOrder {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Event, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "event_id" })
  event: Event;

  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE", eager: true })
  @JoinColumn({ name: "buyer_user_id" })
  buyer: User;

  @Column({ name: "buyer_user_id", type: "uuid" })
  buyerUserId: string;

  @Column({ type: "smallint" })
  quantity: number;

  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  items: Array<{
    ticketTypeId: string;
    name: string;
    quantity: number;
    unitPrice: string;
  }>;

  @Column({ name: "unit_price", type: "numeric", precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: "varchar", length: 3, default: "LRD" })
  currency: string;

  @Column({ name: "total_amount", type: "numeric", precision: 12, scale: 2 })
  totalAmount: string;

  @Column({ name: "payment_reference", type: "varchar", length: 255 })
  paymentReference: string;

  @Column({ name: "payment_note", type: "text", nullable: true })
  paymentNote: string | null;

  @Column({
    type: "enum",
    enum: EventTicketOrderStatus,
    default: EventTicketOrderStatus.PENDING_PAYMENT_REVIEW,
  })
  status: EventTicketOrderStatus;

  @Column({
    name: "ticket_code",
    type: "varchar",
    length: 40,
    nullable: true,
    unique: true,
  })
  ticketCode: string | null;

  @Column({ name: "review_note", type: "text", nullable: true })
  reviewNote: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
