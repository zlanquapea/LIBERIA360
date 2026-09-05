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
 *
 * Same email-only-recipient model as TripInvitation (Sep 5, 2026 —
 * originally this required an existing account before anything was
 * created, reasoning that a ticket's QR is a bearer-like credential; that
 * turned out to be the wrong tradeoff in practice, since "the person I'm
 * sending this to hasn't signed up yet" is the exact case this feature
 * exists for): `toUserId` starts null when the address has no account yet
 * and gets linked up later — either by `AuthService.register` when they
 * sign up through the emailed link (see
 * EventTicketsService.linkTicketTransferToNewAccount), or by whoever
 * accepts/declines while holding the token, if they registered some other
 * way (see acceptTransferRow/declineTransferRow's `toUserId ?? user.id`
 * fallback, identical to TripInvitation's). The token itself — not the
 * `email` column — is what proves someone is the intended recipient once
 * `toUserId` is unset; `email` is kept for the receipt/history and for
 * matching the address against whoever's signing up.
 *
 * One row per (ticketInstance, pending-or-not) — a new transfer can't be
 * created for an instance that already has a pending one (see
 * EventTicketsService.transferTicket); accepting flips
 * `EventTicketInstance.currentOwnerUserId` to the accepting account and
 * leaves this row as a permanent accepted/declined/cancelled receipt.
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

  // The address the sender typed, kept verbatim for the receipt/history.
  // toUserId is resolved from it at creation when an account already
  // exists for it, but is otherwise linked later (registration or
  // accept/decline) — see the class doc comment.
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
