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
import { Business } from "../../businesses/entities/business.entity";
import { User } from "../../users/entities/user.entity";
import { BookingStatus, PaymentProvider, PaymentStatus } from "./booking.enums";

/**
 * A guest's request to reserve something from a Business (Tech Spec §3.3 —
 * hotel booking/availability, tour/experience booking, restaurant
 * reservations, transport booking). One entity covers all four rather than
 * four bespoke ones: `business.type` already tells you which kind it is,
 * and "guest requests dates + party size, business confirms or declines"
 * is the same shape regardless.
 */
@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Business, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Index()
  @Column({ name: "business_id" })
  businessId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "guest_user_id" })
  guest: User;

  @Index()
  @Column({ name: "guest_user_id" })
  guestUserId: string;

  // Single-date for a tour/restaurant/transport booking; requestedEndDate
  // set alongside it for a multi-night hotel stay.
  @Column({ name: "requested_date", type: "date" })
  requestedDate: string;

  @Column({ name: "requested_end_date", type: "date", nullable: true })
  requestedEndDate: string | null;

  @Column({ name: "party_size", type: "smallint", nullable: true })
  partySize: number | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({
    type: "enum",
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ name: "business_response", type: "text", nullable: true })
  businessResponse: string | null;

  @Column({ name: "responded_at", type: "timestamptz", nullable: true })
  respondedAt: Date | null;

  // Payment-readiness fields — see booking.enums.ts. Not wired to any real
  // payment API yet.
  @Column({
    name: "payment_provider",
    type: "enum",
    enum: PaymentProvider,
    default: PaymentProvider.MTN_MOMO,
  })
  paymentProvider: PaymentProvider;

  @Column({
    name: "payment_status",
    type: "enum",
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Column({
    name: "payment_reference",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  paymentReference: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
