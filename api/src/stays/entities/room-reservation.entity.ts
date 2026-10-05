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
import { decimalTransformer } from "../../database/decimal.transformer";
import { RoomType } from "./room-type.entity";
import {
  ReservationSource,
  ReservationStatus,
  StayPaymentMethod,
  StayPaymentStatus,
  type StayCurrency,
} from "./stay.enums";

/**
 * A guest's stay: one room type, some rooms, from check-in day to
 * check-out day. Room name and price are copied in when booked, so a later
 * price change never alters what the guest agreed to.
 */
@Entity("room_reservations")
@Index(["businessId", "checkIn"])
@Index(["roomTypeId", "checkIn"])
@Index(
  "UQ_room_reservations_payment_reference",
  ["paymentMethod", "paymentReference"],
  {
    unique: true,
    where: "payment_reference IS NOT NULL",
  },
)
export class RoomReservation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Short reference the guest reads out at the front desk, e.g. "K7Q2MP".
  @Index({ unique: true })
  @Column({ type: "varchar", length: 8 })
  code: string;

  @ManyToOne(() => Business, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "business_id" })
  business: Business;

  @Column({ name: "business_id" })
  businessId: string;

  // Null for a walk-in the front desk recorded.
  @ManyToOne(() => User, { eager: true, onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "guest_user_id" })
  guest: User | null;

  @Index()
  @Column({ name: "guest_user_id", type: "uuid", nullable: true })
  guestUserId: string | null;

  @ManyToOne(() => RoomType, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "room_type_id" })
  roomType: RoomType | null;

  @Column({ name: "room_type_id", type: "uuid", nullable: true })
  roomTypeId: string | null;

  @Column({
    type: "enum",
    enum: ReservationSource,
    default: ReservationSource.ONLINE,
  })
  source: ReservationSource;

  @Column({ name: "check_in", type: "date" })
  checkIn: string;

  @Column({ name: "check_out", type: "date" })
  checkOut: string;

  @Column({ type: "smallint" })
  nights: number;

  @Column({ type: "smallint", default: 1 })
  rooms: number;

  @Column({ type: "smallint", default: 1 })
  adults: number;

  @Column({ type: "smallint", default: 0 })
  children: number;

  @Column({ name: "guest_name", type: "varchar", length: 120 })
  guestName: string;

  @Column({ name: "guest_phone", type: "varchar", length: 40, nullable: true })
  guestPhone: string | null;

  // Free text, e.g. "Around 7pm, coming from RIA airport".
  @Column({ name: "arrival_time", type: "varchar", length: 60, nullable: true })
  arrivalTime: string | null;

  @Column({ name: "special_requests", type: "text", nullable: true })
  specialRequests: string | null;

  @Column({ name: "room_name", type: "varchar", length: 80 })
  roomName: string;

  @Column({
    name: "price_per_night",
    type: "numeric",
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  pricePerNight: number;

  @Column({
    name: "total_amount",
    type: "numeric",
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: StayCurrency;

  @Column({
    type: "enum",
    enum: ReservationStatus,
    default: ReservationStatus.REQUESTED,
  })
  status: ReservationStatus;

  @Column({
    name: "payment_method",
    type: "enum",
    enum: StayPaymentMethod,
  })
  paymentMethod: StayPaymentMethod;

  @Column({
    name: "payment_status",
    type: "enum",
    enum: StayPaymentStatus,
  })
  paymentStatus: StayPaymentStatus;

  @Column({
    name: "payment_reference",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  paymentReference: string | null;

  // The number the guest was told to pay, kept as it was then.
  @Column({
    name: "payment_account",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  paymentAccount: string | null;

  // What the property told the guest (a decline reason, directions...).
  @Column({ name: "property_note", type: "text", nullable: true })
  propertyNote: string | null;

  // Assigned by the front desk at check-in, e.g. "12, 14".
  @Column({ name: "room_numbers", type: "varchar", length: 60, nullable: true })
  roomNumbers: string | null;

  @Column({ name: "confirmed_at", type: "timestamptz", nullable: true })
  confirmedAt: Date | null;

  @Column({ name: "checked_in_at", type: "timestamptz", nullable: true })
  checkedInAt: Date | null;

  @Column({ name: "checked_out_at", type: "timestamptz", nullable: true })
  checkedOutAt: Date | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
