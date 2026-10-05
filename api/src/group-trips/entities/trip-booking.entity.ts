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
import { Itinerary } from "../../itineraries/entities/itinerary.entity";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import {
  TripBookingPaymentStatus,
  TripBookingStatus,
  TripPaymentMethod,
  TripPaymentPlan,
  type TripTraveller,
} from "./group-trip.enums";
import { TripBookingPayment } from "./trip-booking-payment.entity";

const money = {
  type: "numeric" as const,
  precision: 10,
  scale: 2,
  transformer: decimalTransformer,
};

/**
 * Spots on an organised trip, booked by one person for themselves and
 * anyone travelling with them. The price is copied in when booked, so a
 * later price change never alters what the traveller agreed to. Each
 * traveller's name is kept for the organiser's passenger list and the
 * roll call on departure day.
 */
@Entity("trip_bookings")
@Index(["itineraryId", "status"])
export class TripBooking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 12, unique: true })
  code: string;

  @ManyToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary: Itinerary;

  @Column({ name: "itinerary_id", type: "uuid" })
  itineraryId: string;

  @Index()
  @Column({ name: "host_user_id", type: "uuid" })
  hostUserId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @Column({
    type: "enum",
    enum: TripBookingStatus,
    enumName: "trip_booking_status_enum",
  })
  status: TripBookingStatus;

  @Column({ type: "smallint" })
  seats: number;

  @Column({ type: "jsonb", default: () => "'[]'" })
  travellers: TripTraveller[];

  @Column({ name: "contact_name", type: "varchar", length: 120 })
  contactName: string;

  @Column({ type: "varchar", length: 30 })
  phone: string;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "unit_price", ...money })
  unitPrice: number;

  @Column({ name: "total_amount", ...money })
  totalAmount: number;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: string;

  /** The whole booking's deposit (per-person deposit × seats) when the
   * traveller chose to pay a deposit first; null when paying in full. */
  @Column({ name: "deposit_amount", ...money, nullable: true })
  depositAmount: number | null;

  @Column({
    name: "payment_plan",
    type: "enum",
    enum: TripPaymentPlan,
    enumName: "trip_payment_plan_enum",
    default: TripPaymentPlan.FULL,
  })
  paymentPlan: TripPaymentPlan;

  @Column({
    name: "payment_method",
    type: "enum",
    enum: TripPaymentMethod,
    enumName: "trip_payment_method_enum",
    nullable: true,
  })
  paymentMethod: TripPaymentMethod | null;

  @Column({ name: "amount_paid", ...money, default: 0 })
  amountPaid: number;

  @Column({
    name: "payment_status",
    type: "enum",
    enum: TripBookingPaymentStatus,
    enumName: "trip_booking_payment_status_enum",
  })
  paymentStatus: TripBookingPaymentStatus;

  @Column({ name: "host_note", type: "text", nullable: true })
  hostNote: string | null;

  /** Set when confirming made the traveller a member of the trip (its
   * plan and group chat), so cancelling removes only what booking added. */
  @Column({ name: "added_as_member", type: "boolean", default: false })
  addedAsMember: boolean;

  @OneToMany(() => TripBookingPayment, (p) => p.booking)
  payments: TripBookingPayment[];

  @Column({ name: "confirmed_at", type: "timestamptz", nullable: true })
  confirmedAt: Date | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
