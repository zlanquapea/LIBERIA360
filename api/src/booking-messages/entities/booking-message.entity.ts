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
 * gets cleared. Deliberately narrow: no attachments, no read receipts,
 * no editing/deleting — plain text notes tied to a specific booking.
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
}
