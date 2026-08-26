import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Booking } from "../../bookings/entities/booking.entity";
import { User } from "../../users/entities/user.entity";

/**
 * Threaded messages on a booking, between the guest and the business
 * owner. Keeps booking-related conversation auditable and in-platform
 * instead of only a `wa.me` deep-link off to WhatsApp — the same
 * conversation, but visible if there's ever a dispute over what was
 * agreed, and not lost the moment someone's personal WhatsApp history
 * gets cleared. Deliberately narrow: no attachments; plain text notes
 * tied to a specific booking. The sender (and only the sender) can edit
 * or delete their own message afterward — see editedAt/deletedAt below.
 */
@Entity("booking_messages")
export class BookingMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Booking, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking: Booking;

  @Index()
  @Column({ name: "booking_id" })
  bookingId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "sender_user_id" })
  sender: User;

  @Column({ name: "sender_user_id" })
  senderUserId: string;

  @Column({ type: "text" })
  body: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  /** Set once the *other* participant has opened this booking's thread
   * after this message was sent (see BookingMessagesService.markRead) —
   * lets the sender's UI show a "Delivered" -> "Viewed" read receipt, the
   * same way a chat app's checkmarks work. Null until then; never set by
   * the sender on their own messages. */
  @Column({ name: "read_at", type: "timestamp", nullable: true })
  readAt: Date | null;

  /** Set when the sender edits this message's `body` after sending it —
   * surfaced to both participants as an "(edited)" marker (WhatsApp/
   * Messenger convention: a silent edit would let either side quietly
   * rewrite what was agreed on a booking). No edit history is kept, only
   * that an edit happened. */
  @Column({ name: "edited_at", type: "timestamp", nullable: true })
  editedAt: Date | null;

  /** Set when the sender deletes this message. Soft delete, not a row
   * removal — `body` is left in place in the database in case a dispute
   * ever needs it, but the API always redacts it once this is set (see
   * BookingMessagesController's sanitize()), rendering as "This message
   * was deleted" to both participants, the same as WhatsApp/Messenger. */
  @Column({ name: "deleted_at", type: "timestamp", nullable: true })
  deletedAt: Date | null;
}
