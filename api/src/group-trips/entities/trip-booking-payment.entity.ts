import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { decimalTransformer } from "../../database/decimal.transformer";
import { TripPaymentMethod, TripPaymentRecordStatus } from "./group-trip.enums";
import { TripBooking } from "./trip-booking.entity";

/**
 * One payment toward a trip booking. A booking can take several — a
 * deposit now and the balance later, or cash handed over in parts. A
 * mobile money transaction ID can only ever be used once.
 */
@Entity("trip_booking_payments")
@Index("UQ_trip_booking_payments_reference", ["method", "reference"], {
  unique: true,
  where: "reference IS NOT NULL",
})
export class TripBookingPayment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => TripBooking, (b) => b.payments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "booking_id" })
  booking: TripBooking;

  @Index()
  @Column({ name: "booking_id", type: "uuid" })
  bookingId: string;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  @Column({
    type: "enum",
    enum: TripPaymentMethod,
    enumName: "trip_payment_method_enum",
  })
  method: TripPaymentMethod;

  @Column({ type: "varchar", length: 80, nullable: true })
  reference: string | null;

  /** The organiser's number the money was sent to. */
  @Column({ type: "varchar", length: 20, nullable: true })
  account: string | null;

  @Column({
    type: "enum",
    enum: TripPaymentRecordStatus,
    enumName: "trip_payment_record_status_enum",
  })
  status: TripPaymentRecordStatus;

  /** True when the organiser recorded it themselves (cash in hand). */
  @Column({ name: "recorded_by_host", type: "boolean", default: false })
  recordedByHost: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt: Date | null;
}
