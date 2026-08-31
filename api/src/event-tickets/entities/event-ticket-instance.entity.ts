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

  // Denormalized off order.eventId so a scan can check "does this ticket
  // belong to the event being scanned at" without joining through the
  // order — and so the wrong-event scan state can be reported before
  // that join would even happen.
  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event: Event;

  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  // This ticket's position within its order (1-based), independent of
  // ticket type — what "Ticket 3 of 5" means in the buyer's ticket list.
  @Column({ type: "smallint" })
  sequence: number;

  // Null for a legacy non-typed event (single ticketPrice/ticketCapacity);
  // ticketTypeName is always set (denormalized at issuance) so a display
  // label survives even if the organizer later edits or removes that
  // ticket type from the event.
  @Column({
    name: "ticket_type_id",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  ticketTypeId: string | null;

  @Column({ name: "ticket_type_name", type: "varchar", length: 120 })
  ticketTypeName: string;

  // Human-readable ID for display and support lookups, e.g. "L360-VIP-00291"
  // — distinct from the QR's actual security token, which this never is.
  @Column({ name: "ticket_number", type: "varchar", length: 40 })
  ticketNumber: string;

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
