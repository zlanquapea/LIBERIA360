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
import { CarListing } from "../../car-listings/entities/car-listing.entity";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import {
  type ExtraCharge,
  FuelLevel,
  RentalPaymentMethod,
  RentalPaymentStatus,
  RentalStatus,
  RentalUnit,
} from "./rental.enums";

const money = {
  type: "numeric" as const,
  precision: 10,
  scale: 2,
  transformer: decimalTransformer,
};

/**
 * A renter's trip in one car: booked, handed over, driven, returned. The
 * car's name, photo and prices are copied in when booked, so later
 * changes to the listing never alter what the renter agreed to. Handover
 * and return readings (odometer, fuel, condition) are kept so both sides
 * have the same record if anything is disputed.
 */
@Entity("car_rentals")
@Index(["carListingId", "pickupDate"])
@Index(["ownerUserId", "pickupDate"])
@Index(
  "UQ_car_rentals_payment_reference",
  ["paymentMethod", "paymentReference"],
  { unique: true, where: "payment_reference IS NOT NULL" },
)
export class CarRental {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Short reference read out at handover, e.g. "K7Q2MP".
  @Index({ unique: true })
  @Column({ type: "varchar", length: 8 })
  code: string;

  @ManyToOne(() => CarListing, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "car_listing_id" })
  carListing: CarListing | null;

  @Column({ name: "car_listing_id", type: "uuid", nullable: true })
  carListingId: string | null;

  // The car's owner when it was booked, so the desk survives the listing
  // being deleted.
  @Column({ name: "owner_user_id", type: "uuid" })
  ownerUserId: string;

  @ManyToOne(() => User, { eager: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "renter_user_id" })
  renter: User;

  @Index()
  @Column({ name: "renter_user_id", type: "uuid" })
  renterUserId: string;

  @Column({ type: "enum", enum: RentalStatus, default: RentalStatus.REQUESTED })
  status: RentalStatus;

  @Column({
    name: "rental_unit",
    type: "enum",
    enum: RentalUnit,
    default: RentalUnit.DAY,
  })
  rentalUnit: RentalUnit;

  @Column({ name: "pickup_date", type: "date" })
  pickupDate: string;

  @Column({ name: "return_date", type: "date" })
  returnDate: string;

  // "HH:mm"
  @Column({ name: "pickup_time", type: "varchar", length: 5 })
  pickupTime: string;

  @Column({ name: "return_time", type: "varchar", length: 5 })
  returnTime: string;

  // Days for a day rental, hours for an hourly one.
  @Column({ type: "smallint" })
  units: number;

  @Column({ name: "with_driver", default: false })
  withDriver: boolean;

  @Column({ name: "additional_driver", default: false })
  additionalDriver: boolean;

  // Delivered to the renter instead of collected.
  @Column({ default: false })
  delivery: boolean;

  @Column({ name: "delivery_address", type: "text", nullable: true })
  deliveryAddress: string | null;

  @Column({ name: "renter_name", type: "varchar", length: 120 })
  renterName: string;

  @Column({ name: "renter_phone", type: "varchar", length: 40 })
  renterPhone: string;

  @Column({
    name: "licence_number",
    type: "varchar",
    length: 60,
    nullable: true,
  })
  licenceNumber: string | null;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "car_title", type: "varchar", length: 160 })
  carTitle: string;

  @Column({ name: "car_image", type: "text", nullable: true })
  carImage: string | null;

  @Column({
    name: "pickup_location",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  pickupLocation: string | null;

  @Column({ name: "unit_price", ...money })
  unitPrice: number;

  @Column({ name: "base_amount", ...money })
  baseAmount: number;

  @Column({ name: "driver_fee", ...money, default: 0 })
  driverFee: number;

  @Column({ name: "additional_driver_fee", ...money, default: 0 })
  additionalDriverFee: number;

  @Column({ name: "delivery_fee", ...money, default: 0 })
  deliveryFee: number;

  // What the renter pays for the rental itself.
  @Column({ name: "total_amount", ...money })
  totalAmount: number;

  // Refundable, collected in cash at handover; separate from the total.
  @Column({ name: "deposit_amount", ...money, nullable: true })
  depositAmount: number | null;

  // Copied from the listing for the return check.
  @Column({ name: "mileage_limit_per_day", type: "int", nullable: true })
  mileageLimitPerDay: number | null;

  @Column({ name: "excess_mileage_fee", ...money, nullable: true })
  excessMileageFee: number | null;

  @Column({ type: "varchar", length: 3, default: "USD" })
  currency: string;

  @Column({
    name: "payment_method",
    type: "enum",
    enum: RentalPaymentMethod,
  })
  paymentMethod: RentalPaymentMethod;

  @Column({
    name: "payment_status",
    type: "enum",
    enum: RentalPaymentStatus,
  })
  paymentStatus: RentalPaymentStatus;

  @Column({
    name: "payment_reference",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  paymentReference: string | null;

  @Column({
    name: "payment_account",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  paymentAccount: string | null;

  // What the owner told the renter: a decline reason, where to meet...
  @Column({ name: "owner_note", type: "text", nullable: true })
  ownerNote: string | null;

  // ── Handover ───────────────────────────────────────────────────────
  @Column({ name: "picked_up_at", type: "timestamptz", nullable: true })
  pickedUpAt: Date | null;

  @Column({ name: "pickup_odometer", type: "int", nullable: true })
  pickupOdometer: number | null;

  @Column({
    name: "pickup_fuel",
    type: "enum",
    enum: FuelLevel,
    enumName: "car_rentals_fuel_enum",
    nullable: true,
  })
  pickupFuel: FuelLevel | null;

  @Column({ name: "pickup_notes", type: "text", nullable: true })
  pickupNotes: string | null;

  @Column({ name: "licence_checked", default: false })
  licenceChecked: boolean;

  @Column({ name: "deposit_collected", ...money, nullable: true })
  depositCollected: number | null;

  // ── Return ─────────────────────────────────────────────────────────
  @Column({ name: "returned_at", type: "timestamptz", nullable: true })
  returnedAt: Date | null;

  @Column({ name: "return_odometer", type: "int", nullable: true })
  returnOdometer: number | null;

  @Column({
    name: "return_fuel",
    type: "enum",
    enum: FuelLevel,
    enumName: "car_rentals_fuel_enum",
    nullable: true,
  })
  returnFuel: FuelLevel | null;

  @Column({ name: "return_notes", type: "text", nullable: true })
  returnNotes: string | null;

  @Column({
    name: "extra_charges",
    type: "jsonb",
    default: () => "'[]'::jsonb",
  })
  extraCharges: ExtraCharge[];

  @Column({ name: "extras_total", ...money, default: 0 })
  extrasTotal: number;

  @Column({ name: "deposit_returned", ...money, nullable: true })
  depositReturned: number | null;

  @Column({ name: "confirmed_at", type: "timestamptz", nullable: true })
  confirmedAt: Date | null;

  @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
