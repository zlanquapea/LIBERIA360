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
import { Creator } from "../../creators/entities/creator.entity";
import { CarListing } from "../../car-listings/entities/car-listing.entity";
import { User } from "../../users/entities/user.entity";
import { decimalTransformer } from "../../database/decimal.transformer";
import { BookingStatus, PaymentProvider, PaymentStatus } from "./booking.enums";

/**
 * A guest's request to reserve something from a Business, a Creator, or a
 * specific CarListing (Tech Spec §3.3 — hotel booking/availability, tour/
 * experience booking, restaurant reservations, transport booking, a
 * creator's own bookable services, and renting a specific vehicle). One
 * entity covers all of these rather than bespoke ones per target: "guest
 * requests dates + party size, the listing owner confirms or declines" is
 * the same shape regardless of what's on the other end — including car
 * rental, which just adds a couple of car-specific fields (`withDriver`,
 * `pickupLocation`, a computed `estimatedTotal`) on top of the same
 * request/respond/cancel lifecycle everything else already has, rather
 * than a parallel booking system that would need its own messaging,
 * notifications, and "My Bookings" surface rebuilt from scratch.
 *
 * Targets exactly one of a Business, a Creator, or a CarListing, never
 * more than one — same XOR-at-the-service-layer / nullable-FK convention
 * as Review and AnalyticsEvent (see their doc comments for the "NULL is
 * distinct in a unique constraint" reasoning, though this entity has no
 * per-target uniqueness constraint the way those do — a guest can book
 * the same business/creator/car repeatedly).
 */
@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Business, {
    eager: true,
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "business_id" })
  business: Business | null;

  @Index()
  @Column({ name: "business_id", nullable: true })
  businessId: string | null;

  @ManyToOne(() => Creator, {
    eager: true,
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "creator_id" })
  creator: Creator | null;

  @Index()
  @Column({ name: "creator_id", nullable: true })
  creatorId: string | null;

  @ManyToOne(() => CarListing, {
    eager: true,
    onDelete: "CASCADE",
    nullable: true,
  })
  @JoinColumn({ name: "car_listing_id" })
  carListing: CarListing | null;

  @Index()
  @Column({ name: "car_listing_id", nullable: true })
  carListingId: string | null;

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

  // Car-rental-only fields. `withDriver` is the renter's actual choice at
  // request time (the listing's own `withDriverAvailable` is just
  // whether the option exists at all). `pickupLocation` overrides the
  // car's own default pickup spot for this specific request (an airport
  // drop-off instead of the lot, say) — null means "wherever the listing
  // says". `estimatedTotal` is computed once at creation time from
  // `requestedEndDate - requestedDate` days × the listing's pricePerDay
  // (plus driverFeePerDay × days if `withDriver`) — see
  // BookingsService.create — so both sides see a real number on the
  // request without doing the math themselves; it's a snapshot, not
  // re-derived if the listing's price changes later.
  @Column({ name: "with_driver", type: "boolean", default: false })
  withDriver: boolean;

  @Column({
    name: "pickup_location",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  pickupLocation: string | null;

  @Column({
    name: "estimated_total",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedTotal: number | null;

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
