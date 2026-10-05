import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { Itinerary } from "../../itineraries/entities/itinerary.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import type { TripOrganiser } from "./group-trip.enums";

const money = {
  type: "numeric" as const,
  precision: 10,
  scale: 2,
  transformer: decimalTransformer,
};

/**
 * An organised group trip: someone's trip plan opened up for others to
 * book a spot on, free or paid, the way trips are run in Liberia — a
 * price per person, a set number of spots, what's included, the
 * activities, where the bus leaves from, and how to pay. Kept in its own
 * table so the itinerary row every trip screen loads stays small.
 */
@Entity("hosted_trips")
export class HostedTrip {
  @PrimaryColumn({ name: "itinerary_id", type: "uuid" })
  itineraryId: string;

  @OneToOne(() => Itinerary, { onDelete: "CASCADE" })
  @JoinColumn({ name: "itinerary_id" })
  itinerary: Itinerary;

  /** Taking bookings. Closing keeps every booking; it only stops new ones. */
  @Column({ type: "boolean", default: true })
  open: boolean;

  @Column({ type: "varchar", length: 140, nullable: true })
  tagline: string | null;

  /** Per person. Zero means the trip is free. */
  @Column({ ...money, default: 0 })
  price: number;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: string;

  /** Optional: pay this much to hold a spot, the rest before balanceDueDate. */
  @Column({ name: "deposit_amount", ...money, nullable: true })
  depositAmount: number | null;

  @Column({ name: "balance_due_date", type: "date", nullable: true })
  balanceDueDate: string | null;

  @Column({ name: "booking_deadline", type: "date", nullable: true })
  bookingDeadline: string | null;

  @Column({ type: "smallint" })
  spots: number;

  @Column({ name: "max_per_booking", type: "smallint", default: 6 })
  maxPerBooking: number;

  /** Free trips only: look at each booking before it's confirmed. Paid
   * trips always wait for the organiser to find the payment. */
  @Column({ name: "require_approval", type: "boolean", default: false })
  requireApproval: boolean;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  includes: string[];

  @Column({ type: "text", array: true, default: () => "'{}'" })
  excludes: string[];

  @Column({ type: "text", array: true, default: () => "'{}'" })
  activities: string[];

  @Column({
    name: "meeting_point",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  meetingPoint: string | null;

  /** "07:00", Liberia time. */
  @Column({
    name: "departure_time",
    type: "varchar",
    length: 5,
    nullable: true,
  })
  departureTime: string | null;

  @Column({ type: "jsonb", default: () => "'[]'" })
  organisers: TripOrganiser[];

  @Column({ type: "text", array: true, default: () => "'{}'" })
  gallery: string[];

  @Column({ name: "good_to_know", type: "text", nullable: true })
  goodToKnow: string | null;

  @Column({
    name: "contact_phone",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ name: "cash_enabled", type: "boolean", default: true })
  cashEnabled: boolean;

  @Column({
    name: "mtn_momo_number",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  mtnMomoNumber: string | null;

  @Column({
    name: "orange_money_number",
    type: "varchar",
    length: 20,
    nullable: true,
  })
  orangeMoneyNumber: string | null;

  @Column({
    name: "account_name",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  accountName: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
