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
import { User } from "../../users/entities/user.entity";
import { EventTicketOrder } from "./event-ticket-order.entity";

export enum EventTicketInstanceStatus {
  ISSUED = "issued",
  REDEEMED = "redeemed",
  VOID = "void",
}

@Entity("event_ticket_instances")
@Index(["orderId", "sequence"], { unique: true })
@Index(["tokenHash"], { unique: true })
export class EventTicketInstance {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => EventTicketOrder, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order: EventTicketOrder;

  @Column({ name: "order_id", type: "uuid" })
  orderId: string;

  @Column({ type: "smallint" })
  sequence: number;

  @Column({ name: "token_hash", type: "varchar", length: 64, unique: true })
  tokenHash: string;

  @Column({ name: "token_ciphertext", type: "text" })
  tokenCiphertext: string;

  @Column({
    type: "enum",
    enum: EventTicketInstanceStatus,
    default: EventTicketInstanceStatus.ISSUED,
  })
  status: EventTicketInstanceStatus;

  @Column({ name: "redeemed_at", type: "timestamp", nullable: true })
  redeemedAt: Date | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "redeemed_by_user_id" })
  redeemedBy: User | null;

  @Column({ name: "redeemed_by_user_id", type: "uuid", nullable: true })
  redeemedByUserId: string | null;

  @Column({ name: "scan_count", type: "integer", default: 0 })
  scanCount: number;

  @Column({ name: "last_scanned_at", type: "timestamp", nullable: true })
  lastScannedAt: Date | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "last_scanned_by_user_id" })
  lastScannedBy: User | null;

  @Column({ name: "last_scanned_by_user_id", type: "uuid", nullable: true })
  lastScannedByUserId: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
