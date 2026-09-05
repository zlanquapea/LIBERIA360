import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Event } from "../../events/entities/event.entity";
import { User } from "../../users/entities/user.entity";
import { EventTicketInstance } from "./event-ticket-instance.entity";

/** Only three states are ever actually transitioned into — same shape as
 * TripInvitationStatus (see that entity's doc comment for why there's no
 * separate persisted "sent" state: the email is always sent synchronously
 * as part of creating the row, so `emailDelivered` — not a status value —
 * is what tells the sender whether it actually left). */
export enum TicketTransferStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  CANCELLED = "cancelled",
}

const TRANSFER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function transferExpiresAt(): Date {
  return new Date(Date.now() + TRANSFER_TTL_MS);
}

/**
 * A pending or resolved "send this ticket to someone else" handoff for one
 * `EventTicketInstance` (the AFCON-style "buy two, send one" feature).
 * Unlike TripInvitation, this deliberately does NOT support inviting a
 * bare email with no account yet — a ticket is a bearer-like credential
 * (whoever holds the QR can be scanned in), so the recipient must already
 * be a known LIBERIA360 account before anything is created: `toUserId` is
 * always resolved and set at creation time, never left null waiting for a
 * registration to link it up later. That keeps the "who currently holds
 * this ticket" question always answerable from `toUserId` alone, with no
 * window where a transfer exists but nobody's account is on the other end
 * of it.
 *
 * One row per (ticketInstance, pending-or-not) — a new transfer can't be
 * created for an instance that already has a pending one (see
 * EventTicketsService.transferTicket); accepting flips
 * `EventTicketInstance.currentOwnerUserId` to `toUserId` and leaves this
 * row as a permanent accepted/declined/cancelled receipt.
 */
@Entity("ticket_transfers")
@Index(["ticketInstanceId", "status"])
export class TicketTransfer {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => EventTicketInstance, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ticket_instance_id" })
  ticketInstance: EventTicketInstance;

  @Column({ name: "ticket_instance_id", type: "uuid" })
  ticketInstanceId: string;

  // Denormalized off ticketInstance.eventId purely so "transfers for this
  // event" (an organizer support/fraud question) doesn't need a join
  // through the instance — same reasoning as EventTicketInstance.eventId
  // itself.
  @ManyToOne(() => Event, { onDelete: "CASCADE" })
  @JoinColumn({ name: "event_id" })
  event: Event;

  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  // The ticket's owner at the moment they initiated the send — not
  // necessarily the original buyer, since a ticket can be re-sent onward
  // by whoever currently holds it.
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "from_user_id" })
  fromUser: User;

  @Column({ name: "from_user_id", type: "uuid" })
  fromUserId: string;

  // The address the sender typed, kept verbatim for the receipt/history
  // even though toUserId (resolved from it at creation) is what every
  // ownership check actually uses.
  @Column({ type: "varchar", length: 255 })
  email: string;

  @Index()
  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "to_user_id" })
  toUser: User | null;

  @Column({ name: "to_user_id", type: "uuid", nullable: true })
  toUserId: string | null;

  // SHA-256 of the accept/decline email link's token — see auth/token-hash.ts.
  @Index({ unique: true })
  @Column({ name: "token_hash", type: "text" })
  tokenHash: string;

  @Column({
    type: "enum",
    enum: TicketTransferStatus,
    default: TicketTransferStatus.PENDING,
  })
  status: TicketTransferStatus;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt: Date | null;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt: Date;

  // MailService's real send outcome for the transfer email — see
  // TripInvitation.emailDelivered's doc comment for why this is tracked
  // separately from `status`.
  @Column({ name: "email_delivered", type: "boolean", default: false })
  emailDelivered: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
